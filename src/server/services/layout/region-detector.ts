/**
 * Region detector abstraction for identifying meaningful regions in datasheet pages.
 * 
 * Design: pluggable implementations that can be swapped or combined.
 * All detectors produce normalized bounding boxes (0..1) and typed region objects.
 */

import type { BoundingBox, EvidenceType } from "@/types/speclens";
import type { ClassificationRule } from "@/services/evidence-extraction";

// ---------------------------------------------------------------------------
// Region region region region region region region region region region region region
// ---------------------------------------------------------------------------

/** A detected visual region on a PDF page. */
export interface DetectedRegion {
  pageNumber: number;
  type: EvidenceType;
  bbox: BoundingBox;
  confidence: number;
  caption: string;
  extractionMethod: "keyword" | "layout" | "visual" | "hybrid";
}

/** Region detector abstraction — a pluggable component that detects regions on a page. */
export interface RegionDetector {
  /** Detect regions on a single page. */
  detectPage(
    pageNumber: number,
    pageWidth: number,
    pageHeight: number,
    textBlocks: Array<{ text: string; x: number; y: number; w: number; h: number }>,
    renderedPageWidth: number,
    renderedPageHeight: number,
  ): DetectedRegion[];

  /** Get the human-readable name of this detector for provenance. */
  getName(): string;
}

// ---------------------------------------------------------------------------
// Keyword-based detector
// ---------------------------------------------------------------------------

/**
 * Detector that identifies regions based on keyword matching in extracted text blocks.
 * Works against PDF text blocks, headings, captions, and figure labels.
 */
export class KeywordRegionDetector implements RegionDetector {
  private rules: ClassificationRule[];

  constructor(rules: ClassificationRule[] = this.defaultRules()) {
    this.rules = rules;
  }

  defaultRules(): ClassificationRule[] {
    return [
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
  }

  getName(): string {
    return "KeywordRegionDetector";
  }

  detectPage(
    pageNumber: number,
    pageWidth: number,
    pageHeight: number,
    textBlocks: Array<{ text: string; x: number; y: number; w: number; h: number }>,
    renderedPageWidth: number,
    renderedPageHeight: number,
  ): DetectedRegion[] {
    const candidates: DetectedRegion[] = [];

    for (const block of textBlocks) {
      if (!block.text.trim()) continue;

      const lower = block.text.toLowerCase();

      // Score each rule against this block
      for (const rule of this.rules) {
        const matched = rule.keywords.filter((kw) => lower.includes(kw));
        if (matched.length === 0) continue;

        // Size weighting: larger blocks get slightly higher confidence
        const density = (block.w * block.h) / (renderedPageWidth * renderedPageHeight);
        const baseConfidence = Math.min(0.95, 0.6 + rule.weight * 0.2 + density * 0.2);

        candidates.push({
          pageNumber,
          type: rule.evidenceType,
          bbox: {
            x: Math.max(0, Math.min(1, block.x / renderedPageWidth)),
            y: Math.max(0, Math.min(1, block.y / renderedPageHeight)),
            w: Math.max(0, Math.min(1, block.w / renderedPageWidth)),
            h: Math.max(0, Math.min(1, block.h / renderedPageHeight)),
          },
          confidence: baseConfidence,
          caption: block.text.trim().substring(0, 100),
          extractionMethod: "keyword",
        });
      }
    }

    return candidates;
  }
}

// ---------------------------------------------------------------------------
// Layout-based detector
// ---------------------------------------------------------------------------

/**
 * Detector that identifies regions based on spatial/layout characteristics
 * of text blocks (aspect ratio, position, size).
 */
export class LayoutRegionDetector implements RegionDetector {
  getName(): string {
    return "LayoutRegionDetector";
  }

  detectPage(
    pageNumber: number,
    pageWidth: number,
    pageHeight: number,
    textBlocks: Array<{ text: string; x: number; y: number; w: number; h: number }>,
    renderedPageWidth: number,
    renderedPageHeight: number,
  ): DetectedRegion[] {
    const candidates: DetectedRegion[] = [];

    for (const block of textBlocks) {
      if (!block.text.trim()) continue;

      const aspectRatio = block.w / Math.max(0.01, block.h);
      const area = block.w * block.h;
      const lower = block.text.toLowerCase().trim();

      // Block diagrams: typically wide with moderate height
      if (aspectRatio > 1.5 && aspectRatio < 3.0 && area > 0.05 && /block|diagram/.test(lower)) {
        candidates.push({
          pageNumber,
          type: "block-diagram",
          bbox: {
            x: Math.max(0, Math.min(1, block.x / renderedPageWidth)),
            y: Math.max(0, Math.min(1, block.y / renderedPageHeight)),
            w: Math.max(0, Math.min(1, block.w / renderedPageWidth)),
            h: Math.max(0, Math.min(1, block.h / renderedPageHeight)),
          },
          confidence: 0.75,
          caption: block.text.trim().substring(0, 100),
          extractionMethod: "layout",
        });
      }
      // Timing diagrams: typically narrow and tall
      else if (aspectRatio < 0.8 && area > 0.03 && /timing|waveform|chart/.test(lower)) {
        candidates.push({
          pageNumber,
          type: "timing",
          bbox: {
            x: Math.max(0, Math.min(1, block.x / renderedPageWidth)),
            y: Math.max(0, Math.min(1, block.y / renderedPageHeight)),
            w: Math.max(0, Math.min(1, block.w / renderedPageWidth)),
            h: Math.max(0, Math.min(1, block.h / renderedPageHeight)),
          },
          confidence: 0.75,
          caption: block.text.trim().substring(0, 100),
          extractionMethod: "layout",
        });
      }
      // Application circuits: medium aspect ratio
      else if (aspectRatio >= 0.8 && aspectRatio <= 1.5 && area > 0.05 && /application|circuit/.test(lower)) {
        candidates.push({
          pageNumber,
          type: "application-circuit",
          bbox: {
            x: Math.max(0, Math.min(1, block.x / renderedPageWidth)),
            y: Math.max(0, Math.min(1, block.y / renderedPageHeight)),
            w: Math.max(0, Math.min(1, block.w / renderedPageWidth)),
            h: Math.max(0, Math.min(1, block.h / renderedPageHeight)),
          },
          confidence: 0.75,
          caption: block.text.trim().substring(0, 100),
          extractionMethod: "layout",
        });
      }
      // Functional diagrams: broader area
      else if (area > 0.1 && /functional|internal|logic/.test(lower)) {
        candidates.push({
          pageNumber,
          type: "functional-diagram",
          bbox: {
            x: Math.max(0, Math.min(1, block.x / renderedPageWidth)),
            y: Math.max(0, Math.min(1, block.y / renderedPageHeight)),
            w: Math.max(0, Math.min(1, block.w / renderedPageWidth)),
            h: Math.max(0, Math.min(1, block.h / renderedPageHeight)),
          },
          confidence: 0.7,
          caption: block.text.trim().substring(0, 100),
          extractionMethod: "layout",
        });
      }
      // Pinout diagrams: at top of page
      else if (block.y < 0.15 * pageHeight && area > 0.05 && /pin|terminal/.test(lower)) {
        candidates.push({
          pageNumber,
          type: "pinout",
          bbox: {
            x: Math.max(0, Math.min(1, block.x / renderedPageWidth)),
            y: Math.max(0, Math.min(1, block.y / renderedPageHeight)),
            w: Math.max(0, Math.min(1, block.w / renderedPageWidth)),
            h: Math.max(0, Math.min(1, block.h / renderedPageHeight)),
          },
          confidence: 0.7,
          caption: block.text.trim().substring(0, 100),
          extractionMethod: "layout",
        });
      }
    }

    return candidates;
  }
}

// ---------------------------------------------------------------------------
// Visual density detector
// ---------------------------------------------------------------------------

/**
 * Detector that identifies regions based on image visual characteristics
 * (density, darkness, etc.) from the rendered page image.
 * 
 * Note: This is a skeletal implementation. Full visual detection would
 * require running an actual vision model on the rendered page image.
 * For now, it provides a framework that can be augmented later.
 */
export class VisualRegionDetector implements RegionDetector {
  private readonly confidenceThreshold: number = 0.3;

  getName(): string {
    return "VisualRegionDetector";
  }

  /**
   * Detect regions based on visual signal from a rendered page buffer.
   * 
   * In a full implementation, this would analyze the page image buffer
   * for visual patterns. For now, it returns an empty array since we
 * don't have the image buffer available at this layer.
   */
  detectPage(
    pageNumber: number,
    pageWidth: number,
    pageHeight: number,
    textBlocks: Array<{ text: string; x: number; y: number; w: number; h: number }>,
    renderedPageWidth: number,
    renderedPageHeight: number,
    pageImageBuffer?: Buffer,
  ): DetectedRegion[] {
    // Skeletal: without the actual page image buffer, we cannot perform
    // visual detection. This detector is designed to be used in conjunction
    // with pdf-layout-service which provides the rendered image.
    return [];
  }

  /**
   * Attempt visual detection using a page image buffer.
   * 
   * @param buffer Rendered page image buffer (WebP/PNG)
   * @returns Detected regions or empty array if buffer not available
   */
  detectFromImage(
    pageNumber: number,
    pageWidth: number,
    pageHeight: number,
    pageImageBuffer: Buffer,
  ): DetectedRegion[] {
    // Placeholder: full visual detection would require an ML model.
    // This method exists for future augmentation.
    return [];
  }
}

// ---------------------------------------------------------------------------
// Hybrid detector: combines multiple detectors
// ---------------------------------------------------------------------------

/**
 * Combines multiple RegionDetector implementations, deduplicates
 * overlapping bounding boxes, and returns the top-confidence candidates.
 */
export class HybridRegionDetector implements RegionDetector {
  private detectors: RegionDetector[];

  constructor(detectors: RegionDetector[]) {
    this.detectors = detectors;
  }

  getName(): string {
    return "HybridRegionDetector";
  }

  detectPage(
    pageNumber: number,
    pageWidth: number,
    pageHeight: number,
    textBlocks: Array<{ text: string; x: number; y: number; w: number; h: number }>,
    renderedPageWidth: number,
    renderedPageHeight: number,
  ): DetectedRegion[] {
    // Run all detectors in parallel and collect candidates
    const allCandidates: DetectedRegion[] = [];

    for (const detector of this.detectors) {
      const results = detector.detectPage(
        pageNumber,
        pageWidth,
        pageHeight,
        textBlocks,
        renderedPageWidth,
        renderedPageHeight,
      );
      allCandidates.push(...results);
    }

    // Deduplicate using IoU
    const deduped = this.deduplicate(allCandidates, pageWidth, pageHeight);

    // Sort by confidence (highest first)
    return deduped.sort((a, b) => b.confidence - a.confidence);
  }

  private deduplicate(
    candidates: DetectedRegion[],
    pageWidth: number,
    pageHeight: number,
  ): DetectedRegion[] {
    if (candidates.length <= 1) return candidates;

    const kept: DetectedRegion[] = [];

    for (const candidate of candidates) {
      // Check if this candidate overlaps significantly with any already-kept candidate
      let hasSignificantOverlap = false;
      for (const keptCandidate of kept) {
        if (doBoundsOverlap(candidate.bbox, keptCandidate.bbox, pageWidth, pageHeight, 0.15)) {
          // If overlap is significant, keep the higher-confidence one
          if (candidate.confidence > keptCandidate.confidence) {
            // Replace the kept candidate
            const index = kept.indexOf(keptCandidate);
            kept[index] = candidate;
          }
          hasSignificantOverlap = true;
          break;
        }
      }
      if (!hasSignificantOverlap) {
        kept.push(candidate);
      }
    }

    return kept;
  }
}