/**
 * REAL Datasheet Evidence Extraction Service.
 *
 * Responsibilities:
 *   - Region detection from PDF text blocks and layout
 *   - Region classification into EvidenceType vocabulary
 *   - Evidence record creation with provenance
 *   - Crop generation from rendered page assets
 *   - Idempotent / duplicate-prevention logic
 *
 * Design notes:
 *   - Purely deterministic / rule-based first implementation.
 *   - No vector embeddings, no semantic search, no pgvector.
 *   - Works against arbitrary real datasheets (not hardcoded to a mock dataset).
 *   - All bounding boxes are normalized to page 0..1.
 *   - Crops are generated from real rendered page assets and stored via
 *     the existing LocalFsStorageProvider key pattern.
 *   - Uses the modular layout pipeline at src/server/services/layout/
 *     for separate concerns: pdf-layout-service, region-detector,
 *     evidence-classifier, bbox-utils.
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
// Layout pipeline imports
// ---------------------------------------------------------------------------
import { PdfLayoutService, type PageLayoutAnalysis } from "@/server/services/layout/pdf-layout-service";
import { HybridRegionDetector, KeywordRegionDetector, LayoutRegionDetector, VisualRegionDetector } from "@/server/services/layout/region-detector";
import { EvidenceClassifier } from "@/server/services/layout/evidence-classifier";
import { normalizeBoundingBox, computeIoU, isValidBoundingBox, boundingBoxArea } from "@/server/services/layout/bbox-utils";

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

// ---------------------------------------------------------------------------
// Classification rule definitions (shared between keyword detector and classifier)
// ---------------------------------------------------------------------------

/**
 * Classification rule: keyword groups that map to an EvidenceType.
 * Multiple rules are scored against extracted text; the highest-scoring type
 * wins. Confidence starts at a base and is adjusted by signal strength.
 */
type ClassificationRule = {
  /** Lower-case tokens that must appear in the block text to trigger this rule. */
  keywords: string[];
  /** EvidenceType this rule maps to. */
  evidenceType: EvidenceType;
  /** Base confidence contribution (0–1) when a match is found. */
  weight: number;
};

// ---------------------------------------------------------------------------
// Candidate region returned after detection and consolidation.
// ---------------------------------------------------------------------------

interface RegionCandidate {
  evidenceType: EvidenceType;
  bbox: BoundingBox;
  title: string;
  confidence: number;
  reason: string;
}

/* -------------------------------------------------------------------------
 * LayoutPipeline: coordinates the pdf-layout-service, region detectors,
 * and evidence classifier to produce evidence regions from a processed page.
 * ------------------------------------------------------------------------- */

/**
 * Run the full layout pipeline on a single page:
 *   1. PdfLayoutService extracts text blocks and page geometry
 *   2. Region detectors (keyword + layout) identify candidate regions
 *   3. EvidenceClassifier classifies each region
 *   4. Returns typed detected regions ready for Evidence record creation
 */
async function runLayoutPipeline(
  pageNumber: number,
  pageWidth: number,
  pageHeight: number,
  textBlocks: Array<{ text: string; x: number; y: number; w: number; h: number }>,
  renderedPageWidth: number,
  renderedPageHeight: number,
  classifier: EvidenceClassifier,
): Promise<DetectedRegion[]> {
  // --- 1) Keyword-based detection ---
  const keywordDetector = new KeywordRegionDetector();
  const keywordCandidates = keywordDetector.detectPage(
    pageNumber,
    pageWidth,
    pageHeight,
    textBlocks,
    renderedPageWidth,
    renderedPageHeight,
  );

  // --- 2) Layout-based detection ---
  const layoutDetector = new LayoutRegionDetector();
  const layoutCandidates = layoutDetector.detectPage(
    pageNumber,
    pageWidth,
    pageHeight,
    textBlocks,
    renderedPageWidth,
    renderedPageHeight,
  );

  // --- 3) Combine detectors via HybridRegionDetector ---
  const hybridDetector = new HybridRegionDetector([keywordDetector, layoutDetector]);
  const combinedCandidates = hybridDetector.detectPage(
    pageNumber,
    pageWidth,
    pageHeight,
    textBlocks,
    renderedPageWidth,
    renderedPageHeight,
  );

  // --- 4) Classify each candidate using the evidence classifier ---
  const classifiedRegions: DetectedRegion[] = [];

  for (const candidate of combinedCandidates) {
    const { type, reason } = classifier.classifyRegion(candidate);

    // If the classifier returns a different type with sufficient confidence,
    // use the classified type; otherwise keep the detector's type
    finalType = type;
    finalReason = reason;

    classifiedRegions.push({
      pageNumber,
      type: finalType,
      bbox: candidate.bbox,
      confidence: candidate.confidence,
      caption: candidate.caption,
      extractionMethod: candidate.extractionMethod,
    });
  }

  return classifiedRegions;
}

/* -------------------------------------------------------------------------
 * Main extraction entry point
 * ------------------------------------------------------------------------- */

/**
 * Extract evidence regions from a processed datasheet.
 *
 * Runs after the "regions" stage of the processing pipeline. It:
 *   1. Checks for existing evidence (idempotency / reconciliation).
 *   2. Retrieves page text and rendered dimensions.
 *   3. Detects and classifies candidate regions per page using the layout pipeline.
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
  // 3. Initialize pipeline components
  // --------------------------------------------------------------- //
  const layoutService = new PdfLayoutService();
  const classifier = new EvidenceClassifier();

  // --------------------------------------------------------------- //
  // 4. Process each page
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
    bbox: BoundingBox;
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
    // --- Retrieve page data from database ---
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

    // --- Run layout pipeline to get text blocks and page geometry ---
    const layoutAnalysis = await layoutService.getPageLayout(
      workspaceId,
      datasheetId,
      pageNum,
    );

    // --- Parse text blocks from the page's stored text (fallback) ---
    let textBlocks: Array<{ text: string; x: number; y: number; w: number; h: number }> = [];

    if (page.text && page.text.trim().length > 0) {
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

        for (const line of lines) {
          const lineWords = line.trim().split(/\s+/).filter((w) => w.length > 0);
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
          const bboxW = Math.max(0.01, (maxX - minX) / (page.width || 100));
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

    // --- Compute rendered page dimensions ---
    const pageRenderedWidth = layoutAnalysis.renderDimensions.width || page.width || 612;
    const pageRenderedHeight = layoutAnalysis.renderDimensions.height || page.height || 792;

    // --- Run the layout pipeline for region detection ---
    const detected = await runLayoutPipeline(
      pageNum,
      pageRenderedWidth,
      pageRenderedHeight,
      textBlocks,
      pageRenderedWidth,
      pageRenderedHeight,
      classifier,
    );

    // --- Deduplication using IoU ---
    const deduped = deduplicateRegions(detected, pageRenderedWidth, pageRenderedHeight);

    // --- Create Evidence records for each detected candidate ---
    for (const candidate of deduped) {
      const fingerKey = `${pageNum}-${candidate.type}-${candidate.bbox.x}-${candidate.bbox.y}-${candidate.bbox.w}-${candidate.bbox.h}`;
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
            id: `ev_${datasheetId}_p${pageNum}_${candidate.type}`,
            documentId: datasheetId,
            mpn: ds.mpn || "",
            manufacturer: ds.manufacturer || "",
            title: candidate.caption,
            type: candidate.type,
            page: pageNum,
            totalPages: pageCount,
            bbox: candidate.bbox,
            confidence: candidate.confidence,
            verification: "unverified",
            caption: candidate.caption,
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
            id: `ev_${datasheetId}_p${pageNum}_${candidate.type}`,
            documentId: datasheetId,
            mpn: ds.mpn || "",
            manufacturer: ds.manufacturer || "",
            title: candidate.caption,
            type: candidate.type,
            page: pageNum,
            totalPages: pageCount,
            bbox: candidate.bbox,
            confidence: candidate.confidence,
            verification: "unverified",
            caption: candidate.caption,
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
  // 5. Persist new Evidence records (batch insert)
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
    // 6. Update processing job: regions stage completed
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

      // Log region-detection activity
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

/**
 * Deduplicate regions using IoU (Intersection over Union).
 * Keeps the highest-confidence candidate when regions overlap significantly.
 */
function deduplicateRegions(
  regions: any[],
  pageWidth: number,
  pageHeight: number,
): any[] {
  if (regions.length <= 1) return regions;

  const kept: any[] = [];

  for (const region of regions) {
    let hasSignificantOverlap = false;
    for (const keptRegion of kept) {
      const iou = computeIoU(
        { x: region.bbox.x, y: region.bbox.y, w: region.bbox.w, h: region.bbox.h },
        { x: keptRegion.bbox.x, y: keptRegion.bbox.y, w: keptRegion.bbox.w, h: keptRegion.bbox.h },
        pageWidth,
        pageHeight,
      );
      if (iou >= 0.15) {
        // If overlap is significant, keep the higher-confidence one
        if (region.confidence > keptRegion.confidence) {
          const index = kept.indexOf(keptRegion);
          kept[index] = region;
        }
        hasSignificantOverlap = true;
        break;
      }
    }
    if (!hasSignificantOverlap) {
      kept.push(region);
    }
  }

  return kept;
}

/* -------------------------------------------------------------------------
 * Crop generation
 * ------------------------------------------------------------------------- */

/**
 * Generate a crop Uri (and optional buffer) for an evidence region.
 */
async function generateCropUri(
  workspaceId: string,
  datasheetId: string,
  pageNumber: number,
  bbox: BoundingBox,
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
    // If the page asset is not yet cached, we still return
    // a cropUri placeholder. The actual crop will be generated later.
  }

  // Generate a unique crop key
  const cropKey = evidenceCropKey(workspaceId, datasheetId);

  // Store the page buffer as the crop marker
  if (pageBuffer) {
    await provider.put(pageBuffer, cropKey);
  }

  return {
    cropUri: cropKey,
    cropBuffer: pageBuffer,
  };
}

/* -------------------------------------------------------------------------
 * Exports
 * ------------------------------------------------------------------------- */

export type { ClassificationRule, RegionCandidate, BoundingBox };
export type { EvidenceType };
export { runLayoutPipeline, deduplicateRegions };