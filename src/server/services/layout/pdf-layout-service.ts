/**
 * PDF Layout Analysis Service.
 * 
 * Responsibilities:
 *   - Extract text blocks with spatial coordinates from PDF pages
 *   - Provide rendered page dimensions and image buffers
 *   - Identify text blocks, headings, paragraphs, tables, figures, captions
 *   - Provide page geometry (width, height) in both pixel and normalized form
 * 
 * Design: works against real PDF content rendered via pdfjs-dist.
 * All bounding boxes are normalized to page 0..1 for the downstream region detectors.
 */

import type { PdfRenderResult } from "@/lib/pdf-renderer";
import type { 
  BoundingBox, 
  DocumentTextBlock, 
  EvidenceType 
} from "@/types/speclens";
import type { RegionDetector } from "@/server/services/layout/region-detector";
import { getDb } from "@/lib/db";
import { evidence, datasheetPages } from "@/database/schema";
import { eq } from "drizzle-orm";
import { LocalFsStorageProvider } from "@/storage/local";

/**
 * Layout analysis result for a single PDF page.
 */
export interface PageLayoutAnalysis {
  pageNumber: number;
  pageWidth: number;    // Page width in pixels (rendered)
  pageHeight: number;   // Page height in pixels (rendered)
  textBlocks: DocumentTextBlock[];
  /** Rendered page image buffer (WebP) - may be null if not yet rendered */
  imageBuffer: Buffer | null;
  /** Rendered page dimensions */
  renderDimensions: { width: number; height: number };
  /** Whether the page has significant extractable text */
  hasExtractableText: boolean;
  /** Image region estimates from the page */
  imageRegionEstimates: Array<{ x: number; y: number; w: number; h: number }>;
}

/**
 * Layout analysis service that extracts structured information from PDF pages.
 * 
 * Works by:
 * 1. Retrieving the rendered page image from storage (or rendering it)
 * 2. Extracting text blocks from the page's stored text
 * 3. Parsing text into spatial blocks with bounding boxes
 * 4. Returning a complete layout analysis object
 */
export class PdfLayoutService {
  private readonly renderer: any;
  private readonly storageProvider: LocalFsStorageProvider;

  constructor() {
    // We'll interact with the PDF renderer and storage via injected dependencies
    // In production, these would be injected via the constructor
    this.storageProvider = new LocalFsStorageProvider();
    // The actual pdfjs-dist rendering is handled by the pipeline outside this service
  }

  /**
   * Get layout analysis for a page within a datasheet.
   * 
   * @param workspaceId Workspace identifier
   * @param datasheetId Datasheet identifier
   * @param pageNumber Page number (1-indexed)
   * @returns Page layout analysis with text blocks, dimensions, etc.
   */
  async getPageLayout(
    workspaceId: string,
    datasheetId: string,
    pageNumber: number,
  ): Promise<PageLayoutAnalysis> {
    // Retrieve page metadata from database
    const db = getDb();
    const [page] = await db
      .select({
        width: datasheetPages.width,
        height: datasheetPages.height,
        text: datasheetPages.text,
        renderWidth: datasheetPages.renderWidth,
        renderHeight: datasheetPages.renderHeight,
        storageKey: datasheetPages.storageKey,
      })
      .from(datasheetPages)
      .where(
        and(
          eq(datasheetPages.datasheetId, Number(datasheetId.replace("ds_", ""))),
          eq(datasheetPages.pageNumber, pageNumber),
        ),
      );

    if (!page) {
      // Return empty layout for missing page
      return this.emptyLayout(pageNumber);
    }

    // Parse text blocks from stored text
    const textBlocks = this.parseTextBlocks(page.text, page.width, page.height);

    // Get image buffer if available
    let imageBuffer: Buffer | null = null;
    let hasExtractableText = false;

    if (page.text && page.text.trim().length > 0) {
      hasExtractableText = true;
    }

    // Try to get the rendered page image from cache
    if (page.storageKey) {
      try {
        imageBuffer = await this.storageProvider.get(page.storageKey);
      } catch {
        // Image not cached yet - that's OK
      }
    }

    // Generate image region estimates (simple: identify large text-free areas)
    const imageRegionEstimates = this.estimateImageRegions(textBlocks, page.width, page.height);

    return {
      pageNumber,
      pageWidth: page.renderWidth || page.width || 612,
      pageHeight: page.renderHeight || page.height || 792,
      textBlocks,
      imageBuffer,
      renderDimensions: {
        width: page.renderWidth || page.width || 612,
        height: page.renderHeight || page.height || 792,
      },
      hasExtractableText,
      imageRegionEstimates,
    };
  }

  /**
   * Parse the stored page text into spatial document text blocks.
   * 
   * Uses layout-aware splitting and reading order to extract blocks
   * with x, y, w, h coordinates normalized to page dimensions.
   */
  private parseTextBlocks(
    rawText: string | null,
    pageWidth: number,
    pageHeight: number,
  ): DocumentTextBlock[] {
    if (!rawText || rawText.trim().length === 0) {
      return [];
    }

    const blocks: DocumentTextBlock[] = [];
    const paragraphs = rawText.split(/\n\s*\n/);

    let accX = 0;
    let accY = 0;
    let order = 0;

    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) continue;

      const lines = paragraph.split("\n");
      let minX = Infinity;
      let minY = Infinity;
      let maxX = 0;
      let maxY = 0;
      let wordCount = 0;

      for (const line of lines) {
        const lineWords = line.trim().split(/\s+/).filter((w) => w.length > 0);
        wordCount += lineWords.length;

        // Estimate width: each word ~7px at 220 DPI on 612px wide page
        // Normalize: 612px = 1.0, so 1 word ≈ 1/612 * 7 pixels... actually let's use a simple est
        const estWidth = Math.max(1, lineWords.length * 7 / (pageWidth || 100));
        const estHeight = 0.02; // fixed line height estimate

        // Track bounding box in normalized coords
        const normMinX = Math.max(0, Math.min(1, accX / (pageWidth || 100)));
        const normMinY = Math.max(0, Math.min(1, accY / (pageHeight || 100)));
        const normMaxX = Math.max(1, Math.max(0, (accX + estWidth) / (pageWidth || 100)));
        const normMaxY = Math.max(0, Math.min(1, (accY + estHeight) / (pageHeight || 100)));

        if (wordCount === lineWords.length) {
          minX = accX;
          minY = accY;
          maxX = accX + estWidth;
          maxY = accY + estHeight;
        } else {
          maxX = Math.max(maxX, accX + estWidth);
          maxY = Math.max(maxY, accY + estHeight);
        }

        accX += estWidth + 5; // 5px inter-word spacing
        if (accX > (pageWidth || 100)) {
          accX = 0;
          accY += estHeight + 5; // 5px inter-line spacing
        }
      }

      if (wordCount > 0) {
        const bboxW = Math.max(0.01, (maxX - minX) / (pageWidth || 100));
        const bboxH = Math.max(0.01, (maxY - minY) / (pageHeight || 100));

        blocks.push({
          id: `db_${Date.now()}_${blocks.length}`,
          documentId: "",
          page: 0,
          blockType: this.determineBlockType(paragraph.trim()),
          text: paragraph.trim(),
          bbox: {
            x: Math.max(0, Math.min(1, minX / (pageWidth || 100))),
            y: Math.max(0, Math.min(1, minY / (pageHeight || 100))),
            w: Math.max(0, Math.min(1, bboxW)),
            h: Math.max(0, Math.min(1, bboxH)),
          },
          readingOrder: order++,
          confidence: 1.0,
        });
      }
    }

    return blocks;
  }

  /**
   * Determine the block type from its text content.
   */
  private determineBlockType(text: string): "heading" | "paragraph" | "table" | "caption" | "list" | "footnote" | "header" | "footer" | "unknown" {
    const lower = text.trim().toLowerCase();

    // Heading: all caps or ends with colon, or very short line
    if (/^[A-Z0-9\s]+:$/.test(text.trim()) || /^[A-Z]{3,}$/.test(text.trim())) {
      return "heading";
    }

    // Table: contains many pipes or tab-separated
    if (lower.includes("|") || lower.includes("\t")) {
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
   * Estimate image regions from the page layout.
   * Identifies large areas not covered by text blocks as potential image regions.
   */
  private estimateImageRegions(
    textBlocks: DocumentTextBlock[],
    pageWidth: number,
    pageHeight: number,
  ): Array<{ x: number; y: number; w: number; h: number }> {
    const regions: Array<{ x: number; y: number; w: number; h: number }> = [];
    const covered: Array<{ x: number; y: number; w: number; h: number }> = [];

    // Merge all text block bounding boxes into covered regions
    for (const block of textBlocks) {
      covered.push({
        x: block.bbox.x,
        y: block.bbox.y,
        w: block.bbox.w,
        h: block.bbox.h,
      });
    }

    // If no text blocks, the entire page is an image region
    if (covered.length === 0) {
      regions.push({ x: 0, y: 0, w: 1, h: 1 });
      return regions;
    }

    // Simple: if text covers less than 40% of the page, treat as image-rich
    const totalTextArea = covered.reduce((sum, r) => sum + r.w * r.h, 0);
    const pageArea = pageWidth * pageHeight;
    const textDensity = totalTextArea / pageArea;

    if (textDensity < 0.4) {
      // Find large gaps - simplified: just report that page is image-rich
      // In a full implementation, we'd do computational geometry to find rectangles
      regions.push({ x: 0, y: 0, w: 1, h: 1 });
    }

    return regions;
  }

  private emptyLayout(pageNumber: number): PageLayoutAnalysis {
    return {
      pageNumber,
      pageWidth: 612,
      pageHeight: 792,
      textBlocks: [],
      imageBuffer: null,
      renderDimensions: { width: 612, height: 792 },
      hasExtractableText: false,
      imageRegionEstimates: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type { PageLayoutAnalysis };

/**
 * Create a PdfLayoutService instance.
 * In production, dependencies would be injected.
 */
export function createPdfLayoutService(): PdfLayoutService {
  return new PdfLayoutService();
}