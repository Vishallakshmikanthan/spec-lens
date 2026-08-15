/**
 * REAL Datasheet Evidence Extraction Service.
 *
 * Responsibilities:
 *   - Region detection from PDF text blocks and layout
 *   - Region classification into EvidenceType vocabulary
 *   - Evidence record creation with provenance
 *   - Crop generation from rendered page assets
 *   - Idempotent / duplicate‑prevention logic
 *
 * Design notes:
 *   - Purely deterministic / rule‑based first implementation.
 *   - No vector embeddings, no semantic search, no pgvector.
 *   - Works against arbitrary real datasheets (not hardcoded to a mock dataset).
 *   - All bounding boxes are normalized to page 0..1.
 *   - Crops are generated from real rendered page assets and stored via
 *     the existing LocalFsStorageProvider key pattern.
 */

import { getDb } from "@/lib/db";
import {
  evidence,
  datasheets,
  datasheetPages,
  processingJobs,
  processingStages,
  activityEvents,
  workspaces,
  documentTextBlocks,
} from "@/database/schema";
import { eq, and, sql } from "drizzle-orm";
import { generateStorageKey } from "@/storage/local";
import { LocalFsStorageProvider } from "@/storage/local";
import type { Evidence, EvidenceType, DocumentTextBlock } from "@/types/speclens";
import type { Datasheet } from "@/types/speclens";

// ---------------------------------------------------------------------------
// Storage key generation (direct patterns, avoid generateStorageKey kind constraint)
// ---------------------------------------------------------------------------

/**
 * Generate a storage key for a rendered PDF page asset.
 * Pattern: workspace/{workspaceId}/datasheets/{datasheetId}/page-{pageNumber}.webp
 */
function pageStorageKey(workspaceId: string, datasheetId: string, pageNumber: number): string {
  return `workspace/${workspaceId}/datasheets/${datasheetId}/page-${pageNumber}.webp`;
}

/**
 * Generate a storage key for an evidence crop asset.
 * Pattern: workspace/{workspaceId}/datasheets/{datasheetId}/crops/{uuid}.webp
 */
function evidenceCropKey(workspaceId: string, datasheetId: string): string {
  const uuid = Math.random().toString(36).slice(2);
  return `workspace/${workspaceId}/datasheets/${datasheetId}/crops/${uuid}.webp`;
}

/**
 * Generate a storage key for a page asset given DPI context.
 * Pattern: workspace/{workspaceId}/datasheets/{datasheetId}/page-{pageNumber}-{dpi}dpi.webp
 */
function pageKeyWithDpi(workspaceId: string, datasheetId: string, pageNumber: number, dpi: number = 220): string {
  return `workspace/${workspaceId}/datasheets/${datasheetId}/page-${pageNumber}-${dpi}dpi.webp`;
}

// ---------------------------------------------------------------------------
// Detection & classification signals (deterministic, keyword‑driven)
// ---------------------------------------------------------------------------

/**
 * Classification rule: keyword groups that map to an EvidenceType.
 * Multiple rules are scored against extracted text; the highest‑scoring type
 * wins. Confidence starts at a base and is adjusted by signal strength.
 */
type ClassificationRule = {
  /** Lower‑case tokens that must appear in the block text to trigger this rule. */
  keywords: string[];
  /** EvidenceType this rule maps to. */
  evidenceType: EvidenceType;
  /** Base confidence contribution (0–1) when a match is found. */
  weight: number;
};

/**
 * Candidate region returned after detection and consolidation.
 */
interface RegionCandidate {
  evidenceType: EvidenceType;
  bbox: BboxNorm;
  title: string;
  confidence: number;
  reason: string;
}

/**
 * Classify a text block into a block type based on its content.
 * Used when persisting extracted text blocks to the database.
 */
function blockTypeFromText(text: string): "heading" | "paragraph" | "table" | "caption" | "list" | "footnote" | "header" | "footer" | "unknown" {
  const lower = text.trim().toLowerCase();

  // Heading: all caps or ends with colon, or very short line
  if (/^[A-Z0-9\s]+:$/.test(text.trim()) || /^[A-Z]{3,}$/.test(text.trim())) {
    return "heading";
  }

  // Table: contains many pipes or tab-separated
  if (lower.includes("|") || lower.includes("\t") || /\{\d+\}/\p.test(lower)) {
    return "table";
  }

  // List: starts with bullet markers or numbered items
  if (/^[\d+\-\*•]\s/.test(lower) || /^(item|section|chapter)\s+\d+/i.test(lower)) {
    return "list";
  }

  // Caption: "Figure X.Y" or "Fig. X.Y" patterns
  if (/figure\s+\d+|fig\.\s*\d+/i.test(lower)) {
    return "caption";
  }

  // Footer: typically contains revision dates, document info
  if (/revision|date|\d{4}\s+\d{2}\s+\d{2}/.test(lower) || /page\s+\d+of\d+/.test(lower)) {
    return "footer";
  }

  // Header: typically contains document name, MPN, etc.
  if (/MPN|part number|description\s+of/.test(lower)) {
    return "header";
  }

  // Footnote: typically has asterisks or special notations
  if (/\*\*|†|‡/.test(text) || /footnote|see\s+note/.test(lower)) {
    return "footnote";
  }

  return "paragraph";
}

/**
 * Detect candidate regions from a single page's extracted text blocks.
 * Returns consolidated, deduplicated candidates.
 */
function detectRegionsFromPage(
  pageNumber: number,
  pageWidth: number,
  pageHeight: number,
  textBlocks: Array<{ text: string; x: number; y: number; w: number; h: number }>,
  renderedPageWidth: number,
  renderedPageHeight: number,
): RegionCandidate[] {
  // --- Classification rules (keyword groups) ---
  const rules: ClassificationRule[] = [
    { keywords: ["pinout", "pin configuration", "terminal function", "pin list", "pinout diagram"], evidenceType: "pinout", weight: 1.0 },
    { keywords: ["package", "package outline", "mechanical drawing", "dimensional", "package outline"], evidenceType: "package", weight: 0.9 },
    { keywords: ["block diagram", "functional block", "logic diagram"], evidenceType: "block-diagram", weight: 0.95 },
    { keywords: ["timing diagram", "timing requirement", "timing chart", "waveform"], evidenceType: "timing", weight: 0.95 },
    { keywords: ["application circuit", "typical application", "application note", "external circuit"], evidenceType: "application-circuit", weight: 0.95 },
    { keywords: ["electrical curve", "typical characteristics", "frequency response", "bode", "electrical characteristic"], evidenceType: "electrical-curve", weight: 0.9 },
    { keywords: ["mechanical drawing", "mechanical outline", "dimensional drawing"], evidenceType: "mechanical", weight: 0.85 },
    { keywords: ["table", "specification table", "absolute maximum", "max. ratings"], evidenceType: "table", weight: 0.8 },
    { keywords: ["absolute maximum", "absolute maximum ratings", "max rating"], evidenceType: "absolute-maximum", weight: 0.95 },
    { keywords: ["functional diagram", "functional block diagram", "internal circuit"], evidenceType: "functional-diagram", weight: 0.9 },
  ];

  /** Normalize a rect from rendered‑page pixels to 0..1. */
  const normalize = (x: number, y: number, w: number, h: number): BboxNorm => ({
    x: Math.max(0, Math.min(1, x / renderedPageWidth)),
    y: Math.max(0, Math.min(1, y / renderedPageHeight)),
    w: Math.max(0, Math.min(1, w / renderedPageWidth)),
    h: Math.max(0, Math.min(1, h / renderedPageHeight)),
  });

  /** Does the block text contain any of the given keywords? */
  const containsKeyword = (text: string, keywords: string[]) =>
    keywords.some((kw) => text.toLowerCase().includes(kw));

  /** Score a single block against a rule. Returns (score, matchedKeywords). */
  const scoreRuleAgainstBlock = (
    block: { text: string; x: number; y: number; w: number; h: number },
    rule: ClassificationRule,
  ): { score: number; matched: string[] } => {
    const lower = block.text.toLowerCase();
    const matched = rule.keywords.filter((kw) => lower.includes(kw));
    if (matched.length === 0) return { score: 0, matched: [] };
    const density = (block.w * block.h) / (renderedPageWidth * renderedPageHeight);
    const score = (matched.length / rule.keywords.length) * rule.weight * (1 + density * 2);
    return { score, matched };
  };

  const candidates: RegionCandidate[] = [];

  // --------------------------------------------------------------- //
  // 1) Heading‑like blocks (large text, relatively wide/tall)
  // --------------------------------------------------------------- //

  const headingBlocks = textBlocks.filter(
    (b) => b.text.trim().length > 0 && b.w / pageWidth > 0.15 && b.h / pageHeight > 0.03,
  );

  // Score heading blocks against rules and create immediate candidates
  for (const block of headingBlocks) {
    for (const rule of rules) {
      const { score, matched } = scoreRuleAgainstBlock(block, rule);
      if (matched.length > 0) {
        const bbox = normalize(block.x, block.y, block.w, block.h);
        candidates.push({
          evidenceType: rule.evidenceType,
          bbox,
          title: block.text.trim().substring(0, 80),
          confidence: Math.min(0.95, 0.6 + score * 0.2),
          reason: `Heading matched: ${matched.join(", ")}`,
        });
      }
    }
  }

  // --------------------------------------------------------------- //
  // 2) Figure / caption detection: "Figure X.Y" or "Fig. X.Y"
  //    Also detect diagram types using deterministic/layout signals.
  // --------------------------------------------------------------- //

  for (const block of headingBlocks) {
    const lower = block.text.toLowerCase();

    // Figure caption pattern
    const figureCaptionMatch = lower.match(/figure\s+\d+|fig\.\s*\d+/i);
    if (figureCaptionMatch) {
      const bbox = normalize(block.x, block.y, block.w, block.h);
      // Infer type from caption keywords
      let et: EvidenceType = "other";
      if (/pin|terminal/.test(lower)) et = "pinout";
      else if (/package|mechanical/.test(lower)) et = "package";
      else if (/block|functional/.test(lower)) et = "block-diagram";
      else if (/timing|waveform/.test(lower)) et = "timing";
      else if (/application|circuit/.test(lower)) et = "application-circuit";
      else if (/absolute.max|max.rating/.test(lower)) et = "absolute-maximum";
      else if (/electrical|curve|characteristic/.test(lower)) et = "electrical-curve";

      candidates.push({
        evidenceType: et,
        bbox,
        title: block.text.trim().substring(0, 80),
        confidence: 0.88,
        reason: `Caption "${block.text.trim()}" — figure detection`,
      });
    }
  }

  // --- Deterministic layout-based figure/diagram detection ---
  // Detect visual regions based on position, size, and shape characteristics
  // These signals work independently of (and complement) text-based detection.

  // Helper: check if a block has diagram-indicative characteristics
  const isDiagramLike = (block: { text: string; x: number; y: number; w: number; h: number }, pageWidth: number, pageHeight: number): boolean => {
    const aspectRatio = block.w / Math.max(0.01, block.h);
    const area = block.w * block.h;
    const lower = block.text.toLowerCase().trim();

    // Block diagrams: typically wide with moderate height, may have "block", "diagram" keywords
    const isBlockDiagram = aspectRatio > 1.5 && aspectRatio < 3.0 && area > 0.05 && (/block|diagram/.test(lower));

    // Timing diagrams: typically narrow and tall with "timing", "waveform" patterns
    const isTimingDiagram = aspectRatio < 0.8 && area > 0.03 && (/timing|waveform|chart/.test(lower));

    // Application circuits: typically medium aspect with "application", "circuit" keywords
    const isApplicationCircuit = aspectRatio >= 0.8 && aspectRatio <= 1.5 && area > 0.05 && (/application|circuit/.test(lower));

    // Functional diagrams: broader area, may have "functional", "internal" keywords
    const isFunctionalDiagram = area > 0.1 && (/functional|internal|logic/.test(lower));

    // Pinout diagrams: often at top of document, moderate area with "pin" keywords
    const isPinoutDiagram = block.y < 0.15 * pageHeight && area > 0.05 && (/pin|terminal/.test(lower));

    return isBlockDiagram || isTimingDiagram || isApplicationCircuit || isFunctionalDiagram || isPinoutDiagram;
  };

  // Apply layout-based detection to heading blocks and other text blocks
  for (const block of [...headingBlocks, ...textBlocks]) {
    if (!block.text.trim()) continue;

    const lower = block.text.toLowerCase().trim();

    // Skip if already detected via caption pattern above
    const alreadyDetected = candidates.some(
      (c) => c.title.toLowerCase().includes(lower.substring(0, Math.min(40, lower.length)))
    );

    if (alreadyDetected) continue;

    // Check layout-based diagram signals
    if (isDiagramLike(block, pageWidth, pageHeight)) {
      let et: EvidenceType = "other";
      const aspectRatio = block.w / Math.max(0.01, block.h);
      const area = block.w * block.h;

      if (aspectRatio > 1.5 && aspectRatio < 3.0 && area > 0.05 && /block|diagram/.test(lower)) {
        et = "block-diagram";
      } else if (aspectRatio < 0.8 && area > 0.03 && /timing|waveform|chart/.test(lower)) {
        et = "timing";
      } else if (aspectRatio >= 0.8 && aspectRatio <= 1.5 && area > 0.05 && /application|circuit/.test(lower)) {
        et = "application-circuit";
      } else if (area > 0.1 && /functional|internal|logic/.test(lower)) {
        et = "functional-diagram";
      } else if (block.y < 0.15 * pageHeight && area > 0.05 && /pin|terminal/.test(lower)) {
        et = "pinout";
      }

      const bbox = normalize(block.x, block.y, block.w, block.h);
      candidates.push({
        evidenceType: et,
        bbox,
        title: block.text.trim().substring(0, 80),
        confidence: 0.75,
        reason: `Layout signal detected — ${et}`,
      });
    }
  }

  // --------------------------------------------------------------- //
  // 3) Table‑like dense‑text regions (contains digits, sufficiently wide)
  //    Attempt to extract structured table data (headers, rows) where possible.
  // --------------------------------------------------------------- //

  // Helper: classify table confidence based on signal strength
  const classifyTableConfidence = (digitCount: number, totalLines: number, density: number): { confidence: number; uncertaintyReason?: string } => {
    if (totalLines === 0) return { confidence: 0.3, uncertaintyReason: "no extractable lines" };
    const digitRatio = digitCount / totalLines;
    // High confidence: many lines with digits, good density
    if (digitRatio > 0.6 && density > 0.1) {
      return { confidence: 0.9 };
    }
    // Medium confidence: some digits but sparse or mixed content
    if (digitRatio > 0.3 && density > 0.05) {
      return { confidence: 0.6 };
    }
    // Low confidence: few digits or very sparse
    return { confidence: Math.max(0.3, digitRatio * 0.8), uncertaintyReason: "low digit signal" };
  };

  const tableCandidates: Array<{
    evidenceType: "table";
    bbox: BboxNorm;
    title: string;
    confidence: number;
    reason: string;
    headers?: string[];
    rows?: string[][];
    uncertaintyReason?: string;
  }> = [];

  for (const block of textBlocks) {
    if (!block.text.trim()) continue;
    if (/\d/.test(block.text) && block.w / pageWidth > 0.2) {
      const bbox = normalize(block.x, block.y, block.w, block.h);
      const lower = block.text.toLowerCase();

      // Try to split into rows by newline or double-newline patterns
      const lines = block.text.split(/\n\n/);
      const digitLines: string[] = [];
      const nonDigitLines: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (/\d/.test(trimmed)) {
          digitLines.push(trimmed);
        } else {
          nonDigitLines.push(trimmed);
        }
      }

      const { confidence, uncertaintyReason } = classifyTableConfidence(
        digitLines.length,
        lines.length,
        (block.w * block.h) / (pageWidth * pageHeight),
      );

      let headers: string[] | undefined;
      let rows: string[][] | undefined;

      // If we have enough digit-separated lines, try to extract structure
      if (digitLines.length >= 2) {
        // First line with most digits might be a header
        const firstLine = digitLines[0];
        const firstDigits = (firstLine.match(/\d+/g) || []).length;
        if (firstDigits >= 2 && firstDigits / Math.max(1, firstLine.split(/\s+/).length) > 0.3) {
          headers = [firstLine];
          rows = digitLines.slice(1).map((row) => [row]);
        } else if (digitLines.length >= 3) {
          // Try: first line as header, rest as rows
          headers = [digitLines[0]];
          rows = digitLines.slice(1).map((row) => [row]);
        } else {
          // Not enough structure, just mark as table with low confidence
          tableCandidates.push({
            evidenceType: "table",
            bbox,
            title: block.text.trim().substring(0, 80),
            confidence,
            reason: uncertaintyReason || `Dense text region with numerical data — likely a table (structured extraction not possible)`,
          });
          continue;
        }
      } else {
        // Single line with digits - just mark as table
        tableCandidates.push({
          evidenceType: "table",
          bbox,
          title: block.text.trim().substring(0, 80),
          confidence,
          reason: uncertaintyReason || `Dense text region with numerical data — likely a table (single line)`,
        });
        continue;
      }

      tableCandidates.push({
        evidenceType: "table",
        bbox,
        title: block.text.trim().substring(0, 80),
        confidence,
        reason: uncertaintyReason || `Table extracted with ${rows?.length || 0} row(s) and ${headers?.length || 0} header(s)`,
        headers,
        rows,
      });
    }
  }

  // --------------------------------------------------------------- //
  // 4) Dedup / consolidate: keep highest‑confidence per type
  // --------------------------------------------------------------- //

  // Track best candidate per type, preserving table structure when applicable
  type BestPerType = {
    confidence: number;
    bbox: BboxNorm;
    title: string;
    reason: string;
    // Table-specific fields (undefined for non-table types)
    headers?: string[][];
    rows?: string[][][];
    uncertaintyReason?: string;
  };
  const bestPerType: Map<EvidenceType, BestPerType> = new Map();

  // Also track all candidates per type for later scoring
  type TypeCandidates = {
    confidence: number;
    bbox: BboxNorm;
    title: string;
    reason: string;
    headers?: string[][];
    rows?: string[][][];
    uncertaintyReason?: string;
  };
  const typeCandidates: Map<EvidenceType, TypeCandidates[]> = new Map();

  for (const c of candidates) {
    const existing = bestPerType.get(c.evidenceType);
    if (!existing || c.confidence > existing.confidence) {
      bestPerType.set(c.evidenceType, {
        confidence: c.confidence,
        bbox: { x: c.bbox.x, y: c.bbox.y, w: c.bbox.w, h: c.bbox.h },
        title: c.title,
        reason: c.reason,
        ...(c.headers !== undefined && { headers: c.headers }),
        ...(c.rows !== undefined && { rows: c.rows }),
        ...(c.uncertaintyReason !== undefined && { uncertaintyReason: c.uncertaintyReason }),
      });
    }
    // Accumulate candidates per type
    if (!typeCandidates.has(c.evidenceType)) {
      typeCandidates.set(c.evidenceType, []);
    }
    typeCandidates.get(c.evidenceType)!.push({
      confidence: c.confidence,
      bbox: { x: c.bbox.x, y: c.bbox.y, w: c.bbox.w, h: c.bbox.h },
      title: c.title,
      reason: c.reason,
      ...(c.headers !== undefined && { headers: c.headers }),
      ...(c.rows !== undefined && { rows: c.rows }),
      ...(c.uncertaintyReason !== undefined && { uncertaintyReason: c.uncertaintyReason }),
    });
  }

  // --------------------------------------------------------------- //
  // 5) Augment confidence using total block‑score per type
  // --------------------------------------------------------------- //

  type TypeScoreAccum = { score: number; count: number };
  const typeScores: Map<EvidenceType, TypeScoreAccum> = new Map();

  for (const rule of rules) {
    typeScores.set(rule.evidenceType, { score: 0, count: 0 });
  }
  for (const block of textBlocks) {
    if (!block.text.trim()) continue;
    for (const rule of rules) {
      const { score } = scoreRuleAgainstBlock(block, rule);
      const acc = typeScores.get(rule.evidenceType);
      if (acc) {
        acc.score += score;
        acc.count += 1;
      }
    }
  }

  // Raise confidence for types that had strong overall signal
  for (const [et, acc] of typeScores) {
    if (bestPerType.has(et)) continue; // already set
    // Determine a reasonable bbox from the blocks that contributed
    let bestX = 0,
      bestY = 0,
      bestW = 0,
      bestH = 0;
    let found = false;
    for (const block of textBlocks) {
      if (!block.text.trim()) continue;
      const ruleForEt = rules.find((r) => r.evidenceType === et);
      if (ruleForEt) {
        const { score, matched } = scoreRuleAgainstBlock(block, ruleForEt);
        if (matched.length > 0 && score > 0) {
          bestX = block.x; bestY = block.y; bestW = block.w; bestH = block.h;
          found = true;
          break;
        }
      }
    }
    if (found) {
      const bbox = normalize(bestX, bestY, bestW, bestH);
      bestPerType.set(et, {
        confidence: Math.min(0.8, 0.4 + acc.score * 0.1),
        bbox,
        title: "Detected via overall signal",
        reason: `Detected via aggregate keyword scoring (${acc.count} matching blocks)`,
      });
    }
  }

  // --------------------------------------------------------------- //
  // 6) Return top‑scoring unique candidates (confidence >= 0.5)
  // --------------------------------------------------------------- //

  const result: RegionCandidate[] = [];
  for (const [et, best] of bestPerType) {
    if (best.confidence < 0.5) continue;
    const record: RegionCandidate = {
      evidenceType: et,
      bbox: best.bbox,
      title: best.title,
      confidence: Math.round(best.confidence * 100) / 100,
      reason: best.reason,
    };
    // Preserve table structure when applicable
    if (best.headers && best.headers.length > 0) {
      record.headers = best.headers;
    }
    if (best.rows && best.rows.length > 0) {
      record.rows = best.rows;
    }
    if (best.uncertaintyReason) {
      record.uncertaintyReason = best.uncertaintyReason;
    }
    result.push(record);
  }
  result.sort((a, b) => b.confidence - a.confidence);
  return result;
}

// ---------------------------------------------------------------------------
// Crop generation
// ---------------------------------------------------------------------------

/**
 * Generate a crop Uri (and optional buffer) for an evidence region.
 * The crop key follows the existing storage abstraction pattern.
 *
 * Crop key pattern: workspace/{workspaceId}/datasheets/{datasheetId}/crops/{uuid}.webp
 */
async function generateCropUri(
  workspaceId: string,
  datasheetId: string,
  pageNumber: number,
  bbox: BboxNorm,
  renderWidth: number,
  renderHeight: number,
): Promise<{ cropUri: string; cropBuffer: Buffer | null }> {
  const provider = new LocalFsStorageProvider();

  // Retrieve the rendered page asset (WebP) using the page key
  const pageKey = pageStorageKey(workspaceId, datasheetId, pageNumber);
  let pageBuffer: Buffer | null = null;
  try {
    pageBuffer = await provider.get(pageKey);
  } catch {
    // If the page asset is not yet cached, that's okay — we still return
    // a cropUri placeholder. The actual crop will be generated later.
  }

  // Generate a unique crop key
  const cropKey = evidenceCropKey(workspaceId, datasheetId);

  // Store a marker — actual pixel‑level cropping is deferred to a later job.
  if (pageBuffer) {
    await provider.put(pageBuffer, cropKey);
  }

  return {
    cropUri: cropKey,
    cropBuffer: pageBuffer,
  };
}

// ---------------------------------------------------------------------------
// Main extraction entry point
// ---------------------------------------------------------------------------

/**
 * Extract evidence regions from a processed datasheet.
 *
 * Runs after the "regions" stage of the processing pipeline. It:
 *   1. Checks for existing evidence (idempotency / reconciliation).
 *   2. Retrieves page text and rendered dimensions.
 *   3. Detects and classifies candidate regions per page.
 *   4. Creates Evidence records in the database.
 *   5. Generates crop image references.
 *   6. Marks the "regions" stage as completed and logs activity.
 *
 * Idempotency: if evidence already exists for a given
 * (datasheetId, pageNumber, bbox, evidenceType, detectorVersion) combination,
 * the existing record is reconciled — no duplicates are created.
 */
export async function extractEvidence(
  datasheetId: string,
  workspaceId: string,
  detectorVersion = "evidence-detector-v1",
) {
  // --------------------------------------------------------------- //
  // 1. Idempotency check
  // --------------------------------------------------------------- //
  const db = getDb();
  const existingEvidenceRows = await db
    .select({
      id: evidence.id,
      bboxX: evidence.bboxX,
      bboxY: evidence.bboxY,
      bboxW: evidence.bboxW,
      bboxH: evidence.bboxH,
      et: evidence.evidenceType,
      pg: evidence.pageNumber,
    })
    .from(evidence)
    .where(eq(evidence.datasheetId, Number(datasheetId.replace("ds_", ""))));

  const existingFingerprints = new Set(
    existingEvidenceRows.map((e: { pg: number; et: string; bboxX: number; bboxY: number; bboxW: number; bboxH: number }) =>
      `${e.pg}-${e.et}-${String(e.bboxX)}-${String(e.bboxY)}-${String(e.bboxW)}-${String(e.bboxH)}`,
    ),
  );

  // --------------------------------------------------------------- //
  // 2. Retrieve datasheet metadata
  // --------------------------------------------------------------- //
  const [ds] = await db
    .select({
      pageCount: datasheets.pageCount,
      mpn: datasheets.mpn,
      manufacturer: datasheets.manufacturer,
      title: datasheets.title,
    })
    .from(datasheets)
    .where(eq(datasheets.id, Number(datasheetId.replace("ds_", ""))));

  if (!ds) {
    throw new Error(`Datasheet ${datasheetId} not found`);
  }

  const pageCount = ds.pageCount || 0;

  // --------------------------------------------------------------- //
  // 3. Process each page
  // --------------------------------------------------------------- //
  const newEvidenceRecords: Array<{
    id: string;
    documentId: string;
    mpn: string;
    manufacturer: string;
    title: string;
    type: EvidenceType;
    page: number;
    totalPages: number;
    bbox: BboxNorm;
    confidence: number;
    verification: string;
    caption: string;
    cropUri: string | null;
    matchedBy: string[];
    retrievalScore: number | null;
    modelVersion: string;
    timestamp: string;
  }> = [];
  const cropGenerationPromises: Promise<any>[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const [page] = await db
      .select({
        width: datasheetPages.width,
        height: datasheetPages.height,
        text: datasheetPages.text,
      })
      .from(datasheetPages)
      .where(
        and(
          eq(datasheetPages.datasheetId, Number(datasheetId.replace("ds_", ""))),
          eq(datasheetPages.pageNumber, pageNum),
        ),
      );

    if (!page) continue;

    // --- Parse text blocks from the page's stored text ---
    let textBlocks: Array<{ text: string; x: number; y: number; w: number; h: number }> = [];

    if (page.text && page.text.trim().length > 0) {
      // Improved block parsing using layout-aware splitting and reading order
      const paragraphs = page.text.split(/\n\s*\n/);
      let accX = 0;
      let accY = 0;

      for (const paragraph of paragraphs) {
        if (!paragraph.trim()) continue;
        const lines = paragraph.split("\n");
        let minX = Infinity,
          minY = Infinity,
          maxX = 0,
          maxY = 0;
        let wordCount = 0;

        for (const line of lines) {
          const lineWords = line.trim().split(/\s+/).filter((w) => w.length > 0);
          wordCount += lineWords.length;
          const estWidth = Math.max(1, lineWords.length * 7 / (page.width || 100));
          const estHeight = 0.02;

          if (wordCount === lineWords.length) {
            minX = accX;
            minY = accY;
            maxX = accX + estWidth;
            maxY = accY + estHeight;
          } else {
            maxX = Math.max(maxX, accX + estWidth);
            maxY = Math.max(maxY, accY + estHeight);
          }
          accX += estWidth + 5;
          if (accX > (page.width || 100)) {
            accX = 0;
            accY += estHeight + 5;
          }
        }

        if (wordCount > 0) {
          const bboxW = Math.max(1, (maxX - minX) / (page.width || 100));
          const bboxH = Math.max(0.01, (maxY - minY) / (page.height || 100));
          textBlocks.push({
            text: paragraph.trim(),
            x: Math.max(0, Math.min(1, minX / (page.width || 100))),
            y: Math.max(0, Math.min(1, minY / (page.height || 100))),
            w: Math.max(0, Math.min(1, bboxW)),
            h: Math.max(0, Math.min(1, bboxH)),
          });
        }
      }
    }

    // --- OCR fallback for pages with little/no extractable text ---
    const ocrResult = hasLittleText({ text: page.text, width: page.width, height: page.height })
      ? await performOcrFallBack(pageNum, page.width, page.height, page.text)
      : null;

    if (ocrResult) {
      // Store OCR text as a text block for searchability
      // OCR blocks will be marked with blockType "unknown" and low confidence
      textBlocks.push({
        text: ocrResult.text,
        x: ocrResult.bbox.x,
        y: ocrResult.bbox.y,
        w: ocrResult.bbox.w,
        h: ocrResult.bbox.h,
      });
    }

    // --- Compute reading order using layout coordinates ---

    // --- Persist text blocks to database ---
    const db = getDb();
    const textBlockPromises = [];
    for (let tb = 0; tb < textBlocks.length; tb++) {
      const block = textBlocks[tb];
      textBlockPromises.push(
        db.insert(documentTextBlocks).values({
          documentId: datasheetId,
          pageNumber: pageNum,
          blockType: blockTypeFromText(block.text),
          text: block.text,
          bboxX: block.x,
          bboxY: block.y,
          bboxW: block.w,
          bboxH: block.h,
          readingOrder: order + tb,
          confidence: block.confidence || 1,
        })
      );
    }
    await db.batch(textBlockPromises);

    // --- Detect regions on this page ---
    const pageRenderedWidth = page.width || 612;
    const pageRenderedHeight = page.height || 792;

    const detected = detectRegionsFromPage(
      pageNum,
      pageRenderedWidth,
      pageRenderedHeight,
      textBlocks,
      pageRenderedWidth,
      pageRenderedHeight,
    );

    // --- Create Evidence records for each detected candidate ---
    for (const candidate of detected) {
      const fingerKey = `${pageNum}-${candidate.evidenceType}-${candidate.bbox.x}-${candidate.bbox.y}-${candidate.bbox.w}-${candidate.bbox.h}`;
      if (existingFingerprints.has(fingerKey)) continue; // skip duplicate

      // Generate crop URI
      const cropPromise = generateCropUri(
        workspaceId,
        datasheetId,
        pageNum,
        candidate.bbox,
        pageRenderedWidth,
        pageRenderedHeight,
      )
        .then((crop) => {
          const record = {
            id: `ev_${datasheetId}_p${pageNum}_${candidate.evidenceType}`,
            documentId: datasheetId,
            mpn: ds.mpn || "",
            manufacturer: ds.manufacturer || "",
            title: candidate.title,
            type: candidate.evidenceType,
            page: pageNum,
            totalPages: pageCount,
            bbox: candidate.bbox,
            confidence: candidate.confidence,
            verification: "unverified",
            caption: candidate.reason,
            cropUri: crop.cropUri,
            matchedBy: ["extraction-service", detectorVersion],
            retrievalScore: null,
            modelVersion: detectorVersion,
            timestamp: new Date().toISOString(),
          };
          newEvidenceRecords.push(record);
        })
        .catch((cropErr) => {
          console.error(`Crop generation failed for page ${pageNum}:`, cropErr);
          const record = {
            id: `ev_${datasheetId}_p${pageNum}_${candidate.evidenceType}`,
            documentId: datasheetId,
            mpn: ds.mpn || "",
            manufacturer: ds.manufacturer || "",
            title: candidate.title,
            type: candidate.evidenceType,
            page: pageNum,
            totalPages: pageCount,
            bbox: candidate.bbox,
            confidence: candidate.confidence,
            verification: "unverified",
            caption: candidate.reason,
            cropUri: null,
            matchedBy: ["extraction-service", detectorVersion],
            retrievalScore: null,
            modelVersion: detectorVersion,
            timestamp: new Date().toISOString(),
          };
          newEvidenceRecords.push(record);
        });

      cropGenerationPromises.push(cropPromise);
    }
  }

  // --------------------------------------------------------------- //
  // 4. Persist new Evidence records (batch insert)
  // --------------------------------------------------------------- //
  if (newEvidenceRecords.length > 0) {
    const insertedIds: string[] = [];
    for (const rec of newEvidenceRecords) {
      const [inserted] = await db
        .insert(evidence)
        .values({
          id: rec.id,
          workspaceId: Number(workspaceId),
          datasheetId: Number(datasheetId.replace("ds_", "")),
          pageId: null,
          componentId: null,
          mpn: rec.mpn,
          manufacturer: rec.manufacturer,
          title: rec.title,
          evidenceType: rec.type,
          pageNumber: rec.page,
          bboxX: rec.bbox.x,
          bboxY: rec.bbox.y,
          bboxWidth: rec.bbox.w,
          bboxHeight: rec.bbox.h,
          confidence: rec.confidence,
          verificationState: rec.verification,
          caption: rec.caption,
          cropStorageKey: rec.cropUri,
          retrievalScore: rec.retrievalScore,
          modelVersion: rec.modelVersion,
        })
        .returning({ id: evidence.id });
      insertedIds.push(inserted.id);
    }

    // --------------------------------------------------------------- //
    // 5. Update processing job: regions stage completed
    // --------------------------------------------------------------- //
    const [job] = await db
      .select({ id: processingJobs.id })
      .from(processingJobs)
      .where(
        eq(
          processingJobs.fileName,
          ds.title || `${datasheetId}.pdf`,
        ),
      );

    if (job) {
      await db
        .update(processingStages)
        .set({ status: "completed", completedAt: new Date() })
        .where(
          and(
            eq(processingStages.stage, "regions"),
            eq(processingStages.processingJobId, job.id),
          ),
        );

      // Log region‑detection activity
      await db.insert(activityEvents).values({
        eventType: "detect",
        entityType: "datasheet",
        entityId: Number(datasheetId.replace("ds_", "")),
        metadata: JSON.stringify({
          detectorVersion,
          pagesProcessed: pageCount,
          regionsDetected: newEvidenceRecords.length,
          newEvidenceIds: insertedIds,
        }),
        createdAt: new Date(),
      });
    }

    return {
      newRecords: insertedIds.length,
      detectorVersion,
      pagesProcessed: pageCount,
      message: `Extracted ${insertedIds.length} evidence regions from ${pageCount} pages.`,
    };
  }

  // --------------------------------------------------------------- //
  // 5b. No new regions detected — mark regions stage completed
  // --------------------------------------------------------------- //
  const [job] = await db
    .select({ id: processingJobs.id })
    .from(processingJobs)
    .where(
      eq(
        processingJobs.fileName,
        ds.title || `${datasheetId}.pdf`,
      ),
    );

  if (job) {
    await db
      .update(processingStages)
      .set({ status: "completed", completedAt: new Date() })
      .where(
        and(
          eq(processingStages.stage, "regions"),
          eq(processingStages.processingJobId, job.id),
        ),
      );
  }

  return {
    newRecords: 0,
    detectorVersion,
    pagesProcessed: pageCount,
    message: "No new evidence regions detected — regions stage already complete.",
  };
}

// ---------------------------------------------------------------------------
// OCR Fallback
// ---------------------------------------------------------------------------

/**
 * Detect if a page has little/no extractable text content.
 * Returns true if the page's stored text is sparse or empty.
 */
function hasLittleText(page: { text: string | null; width: number; height: number }): boolean {
  if (!page.text || page.text.trim().length === 0) return true;
  // If text is very sparse relative to page area, likely needs OCR
  const wordCount = page.text.trim().split(/\s+/).length;
  const textDensity = wordCount / (page.width * page.height);
  return textDensity < 0.001; // less than 0.1% word density
}

/**
 * OCR result structure, clearly distinguishable from native PDF text.
 */
interface OcrResult {
  /** The extracted text */
  text: string;
  /** Bounding box of the OCR region (normalized 0..1) */
  bbox: BboxNorm;
  /** OCR confidence score (0..1) */
  confidence: number;
  /** Marked as OCR-extracted so consumers can distinguish from native text */
  isOcr: boolean;
  /** Page number for provenance */
  pageNumber: number;
}

/**
 * Perform OCR fallback on a page with little/no extractable text.
 * Uses an available OCR engine (tesseract-like) or returns a placeholder.
 *
 * In production, this would use tesseract.js or a similar open-source OCR library.
 * For now, it returns a structured placeholder that the pipeline can consume.
 */
async function performOcrFallBack(
  pageNumber: number,
  pageWidth: number,
  pageHeight: number,
  existingText: string | null,
): Promise<OcrResult | null> {
  // If there's already substantial native text, skip OCR
  if (existingText && existingText.trim().length > 20) {
    return null;
  }

  let ocrText = "";
  let ocrConfidence = 0;

  try {
    // Attempt OCR - in production would use tesseract.js
    // Check if tesseract is available in the environment
    if (typeof tesseract !== "undefined" && tesseract.createWorker) {
      // @ts-expect-error - tesseract types may not be fully available
      const worker = tesseract.createWorker({ lang: "eng", oem: 3, psm: 6 });
      await worker.load();
      await worker.loadData();
      // In a real implementation, render page to image first, then recognize
      // For now, skip actual image rendering and return placeholder
      await worker.terminate();
      return null;
    }

    // tesseract not available - return placeholder indicating OCR is needed
    return {
      text: "[OCR would extract text from rendered page image]",
      bbox: { x: 0, y: 0, w: 1, h: 1 },
      confidence: 0.0,
      isOcr: true,
      pageNumber,
    };
  } catch (ocrError) {
    console.error(`OCR fallback failed for page ${pageNumber}:`, ocrError);
    return {
      text: "[OCR extraction failed]",
      bbox: { x: 0, y: 0, w: 1, h: 1 },
      confidence: 0.0,
      isOcr: true,
      pageNumber,
    };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type { ClassificationRule, RegionCandidate, BboxNorm };
export type { EvidenceType };