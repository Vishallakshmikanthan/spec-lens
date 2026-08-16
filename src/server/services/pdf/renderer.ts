/**
 * PDF page rendering service.
 *
 * Renders individual pages from a real PDF to PNG/WebP buffers.
 * Capable of configurable DPI/resolution and page dimensions.
 *
 * Architecture:
 *   Server-side only — never imported into browser components.
 *   Uses pdfjs-dist's Node.js worker for PDF parsing and rendering.
 *   Output: Buffer (PNG) or WebP buffer + page width/height.
 *   Stores rendered assets through the existing storage abstraction.
 *   Caches rendered pages to avoid re-rendering.
 */
import { PDFDocumentProxy, getDocument } from "pdfjs-dist";
import { createCanvas } from "canvas";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { Buffer } from "buffer";
import { StorageProvider } from "@/storage/provider";
import { generateStorageKey } from "@/storage/local";
import { createPdfRenderer, PdfRenderConfig, PdfRenderResult } from "@/lib/pdf-renderer";

const MAX_PAGES_PER_BATCH = 50;

/**
 * Configuration for PDF page rendering.
 */
export interface PdfRenderConfig {
  /** DPI (dots per inch) for rendering. Default: 220 */
  dpi?: number;
  /** Output format: "png" or "webp". Default: "webp" */
  format?: "png" | "webp";
  /** Rendering quality for WebP (0-100). Default: 80 */
  quality?: number;
  /** Maximum width in pixels. If exceeded, scales down. */
  maxWidth?: number;
  /** Maximum height in pixels. If exceeded, scales down. */
  maxHeight?: number;
}

/**
 * Result of rendering a single PDF page.
 */
export interface PdfRenderResult {
  /** PNG or WebP buffer of the rendered page */
  imageBuffer: Buffer;
  /** Page width in pixels (rendered) */
  renderWidth: number;
  /** Page height in pixels (rendered) */
  renderHeight: number;
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Whether the result was cached */
  cached: boolean;
  /** Storage key where the image was stored */
  storageKey?: string;
}

/**
 * Renders a PDF page to a PNG/WebP buffer.
 *
 * The PDF file is read from the storage provider. The page is rendered
 * at the specified DPI and format. If the page asset already exists in
 * storage (and is valid), it is reused and re-rendering is skipped.
 *
 * Server-side only — this must not be imported into browser components.
 */
export class PdfPageRenderer {
  private config: PdfRenderConfig;
  private provider: StorageProvider;
  private pdfRenderer: ReturnType<typeof createPdfRenderer>;

  constructor(config: PdfRenderConfig = {}, provider: StorageProvider) {
    this.config = {
      dpi: 220,
      format: "webp",
      quality: 80,
      ...config,
    };
    this.provider = provider;
    this.pdfRenderer = createPdfRenderer(config, provider);
  }

  /**
   * Render a single page from a PDF to a buffer.
   * Checks cache first — if a valid asset exists, it is returned directly.
   */
  async renderPage(
    workspaceId: string,
    datasheetId: string,
    pageNumber: number,
    options: PdfRenderConfig = {},
  ): Promise<PdfRenderResult> {
    const renderConfig = {
      dpi: this.config.dpi,
      format: this.config.format,
      quality: this.config.quality,
      ...options,
    } as PdfRenderConfig;

    // Check cache first — if asset exists and is valid, reuse it
    const cachedKey = this.generateCacheKey(workspaceId, datasheetId, pageNumber, renderConfig);
    if (await this.provider.exists(cachedKey)) {
      try {
        const cachedBuffer = await this.provider.get(cachedKey);
        const cachedMeta = await this.provider.getMetadata(cachedKey);

        // Validate the cached asset is a valid image
        if (this.isValidImage(cachedBuffer, cachedMeta.mimeType)) {
          const dimensions = this.dimensionsFromBuffer(cachedBuffer);
          return {
            imageBuffer: cachedBuffer,
            renderWidth: dimensions.width,
            renderHeight: dimensions.height,
            pageNumber,
            cached: true,
            storageKey: cachedKey,
          };
        }
      } catch {
        // Cache miss or invalid — fall through to render
      }
    }

    // Render the page from the PDF
    const renderResult = await this.pdfRenderer.renderPage(
      workspaceId,
      datasheetId,
      pageNumber,
      renderConfig,
    );

    // Store the rendered asset in cache (pdfRenderer already does this,
    // but we also track the storage key)
    const imageBuffer = renderResult.imageBuffer;
    const storageKey = this.provider.put ? cachedKey : undefined;

    // If provider has put method, the pdfRenderer already stored it;
    // otherwise we need to store it
    if (storageKey && imageBuffer && imageBuffer.length > 0) {
      // The pdfRenderer already stored via its own provider reference
      // We just need to ensure the key is consistent
    }

    const dimensions = this.dimensionsFromBuffer(imageBuffer);

    return {
      imageBuffer,
      renderWidth: dimensions.width,
      renderHeight: dimensions.height,
      pageNumber,
      cached: renderResult.cached,
      storageKey: renderResult.storageKey || cachedKey,
    };
  }

  /**
   * Check if a buffer appears to be a valid image.
   */
  isValidImage(buffer: Buffer, mimeType?: string): boolean {
    if (buffer.length < 4) return false;

    const header = buffer.subarray(0, 4);

    // Check PNG magic bytes
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) {
      return mimeType === "image/png" || mimeType === undefined;
    }

    // Check WebP RIFF header
    if (buffer.length >= 12) {
      const riff = buffer.subarray(0, 4).toString("ascii");
      if (riff === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
        return mimeType === "image/webp" || mimeType === undefined;
      }
    }

    // Check JPEG magic bytes
    if (header[0] === 0xff && header[1] === 0xd8) {
      return mimeType === "image/jpeg" || mimeType === undefined;
    }

    return false;
  }

  /**
   * Extract width/height from a PNG image buffer.
   */
  dimensionsFromBuffer(buffer: Buffer): { width: number; height: number } {
    // For PNG, check for IHDR chunk type "IHDR" (0x49 0x48 0x44 0x52)
    if (buffer.length >= 16) {
      const ihdrType = buffer.subarray(8, 12).toString("ascii");
      if (ihdrType === "IHDR") {
        // Width at offset 16 (4 bytes big-endian), Height at offset 20 (4 bytes big-endian)
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        if (width > 0 && height > 0) {
          return { width, height };
        }
      }
    }

    // Fallback: return configured render dimensions
    return { width: 1100, height: 1100 };
  }

  /**
   * Generate a cache key for a rendered page asset.
   */
  generateCacheKey(
    workspaceId: string,
    datasheetId: string,
    pageNumber: number,
    config: PdfRenderConfig,
  ): string {
    const format = config.format ?? "webp";
    const quality = config.quality ?? 80;
    return generateStorageKey(workspaceId, datasheetId, `page-${pageNumber}.${format}`);
  }
}

/**
 * Create a PdfPageRenderer instance configured for the application.
 */
export function createPdfPageRenderer(
  config: PdfRenderConfig = {},
  provider: StorageProvider,
): PdfPageRenderer {
  return new PdfPageRenderer(config, provider);
}
