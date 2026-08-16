/**
 * PDF processing service index.
 *
 * Exports the PDF parsing and rendering services for use by the
 * upload route and other parts of the application.
 */
import { parsePdf, type ParsedPdf } from "./parser";
import {
  PdfPageRenderer,
  type PdfRenderConfig,
  type PdfRenderResult,
  createPdfPageRenderer,
} from "./renderer";

export type { PdfRenderConfig, PdfRenderResult };

/**
 * Result of processing a complete PDF.
 *
 * Contains all the data needed after processing a PDF:
 * - page count
 * - metadata
 * - per-page text extraction results
 * - rendered page assets with storage keys
 */
export interface PdfProcessingResult {
  pageCount: number;
  metadata: ParsedPdf["metadata"];
  info: ParsedPdf["info"];
  pageTexts: Array<{ pageNumber: number; text: string }>;
  renderResults: Array<PdfRenderResult>;
  storageKeys: Map<number, string>; // pageNumber -> storage key
}

/**
 * Process a complete PDF: parse, extract text, and render all pages.
 *
 * This is the main entry point for PDF processing. It:
 * 1. Validates the PDF is readable
 * 2. Determines the page count
 * 3. Extracts metadata
 * 4. Extracts text from every page (preserving page boundaries)
 * 5. Renders every page to an image (PNG or WebP)
 *
 * @param workspaceId - The workspace ID
 * @param datasheetId - The datasheet ID
 * @param provider - Storage provider with the PDF already stored
 * @param renderConfig - Optional rendering configuration (DPI, format, quality, maxBounds)
 * @returns Complete PDF processing result with all page data
 */
export async function processPdf(
  workspaceId: string,
  datasheetId: string,
  provider: StorageProvider,
  renderConfig: PdfRenderConfig = {},
): Promise<PdfProcessingResult> {
  // Step 1: Get the PDF buffer from storage
  const originalKey = generateStorageKey(workspaceId, datasheetId, "original");
  const pdfBuffer = await provider.get(originalKey);

  // Step 2: Parse the PDF for metadata and page count
  const parsed = await parsePdf(pdfBuffer);

  const pageCount = parsed.pageCount;

  // Step 3: Extract per-page text using pdfjs-dist
  const pageTextPromises = await createPageTextPromises(workspaceId, datasheetId, provider);
  const pageTexts = await Promise.all(pageTextPromises);

  // Step 4: Render every page to an image
  const renderer = createPdfPageRenderer(renderConfig, provider);
  const renderPromises: Array<Promise<PdfRenderResult>> = [];

  for (let i = 1; i <= pageCount; i++) {
    renderPromises[i - 1] = renderer.renderPage(workspaceId, datasheetId, i, renderConfig);
  }
  const renderResults = await Promise.all(renderPromises);

  // Step 5: Build storage keys map (pageNumber -> storage key)
  const storageKeys = new Map<number, string>();
  for (const result of renderResults) {
    if (result.storageKey) {
      // Extract page number from storage key if possible
      // Storage key format: workspace/{workspaceId}/datasheets/{datasheetId}/pages/{uuid}.webp
      // Or we use the result's own storage key
      storageKeys.set(result.pageNumber, result.storageKey);
    } else {
      // Generate a storage key from the render result's format
      const format = renderConfig.format ?? "webp";
      const cacheKey = renderer.generateCacheKey
        ? renderer.generateCacheKey(workspaceId, datasheetId, result.pageNumber, renderConfig)
        : generateStorageKey(workspaceId, datasheetId, `page-${result.pageNumber}.${format}`);
      storageKeys.set(result.pageNumber, cacheKey);
    }
  }

  // Also ensure all page numbers have entries
  for (let i = 1; i <= pageCount; i++) {
    if (!storageKeys.has(i)) {
      const format = renderConfig.format ?? "webp";
      storageKeys.set(i, generateStorageKey(workspaceId, datasheetId, `page-${i}.${format}`));
    }
  }

  return {
    pageCount,
    metadata: parsed.metadata,
    info: parsed.info,
    pageTexts,
    renderResults,
    storageKeys,
  };
}

/**
 * Convenience: render a single page without full PDF processing.
 *
 * Useful for on-demand page rendering in the API endpoints.
 */
export async function renderPage(
  workspaceId: string,
  datasheetId: string,
  pageNumber: number,
  provider: StorageProvider,
  renderConfig: PdfRenderConfig = {},
): Promise<PdfRenderResult> {
  const renderer = createPdfPageRenderer(renderConfig, provider);
  return renderer.renderPage(workspaceId, datasheetId, pageNumber, renderConfig);
}
