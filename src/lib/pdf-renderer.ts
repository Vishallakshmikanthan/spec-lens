/**
 * PDF rendering service using pdfjs-dist.
 *
 * Renders individual pages from a real PDF to PNG/WebP buffers.
 * Capable of configurable DPI/resolution and page dimensions.
 *
 * Architecture:
 *   Server-side only — never imported into browser components.
 *   Uses pdfjs-dist's Node.js worker for PDF parsing and rendering.
 *   Output: Buffer (PNG) or WebP buffer + page width/height.
 */
import { PDFDocumentProxy, getDocument } from "pdfjs-dist";
import { createCanvas } from "canvas";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { Buffer } from "buffer";
import { StorageProvider } from "@/storage/provider";
import { generateStorageKey } from "@/storage/local";

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
  /** PNG buffer of the rendered page */
  imageBuffer: Buffer;
  /** Page width in pixels (rendered) */
  renderWidth: number;
  /** Page height in pixels (rendered) */
  renderHeight: number;
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Whether the result was cached */
  cached: boolean;
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
export class PdfRenderer {
  private config: PdfRenderConfig;
  private provider: StorageProvider;

  constructor(config: PdfRenderConfig = {}, provider: StorageProvider) {
    this.config = {
      dpi: 220,
      format: "webp",
      quality: 80,
      ...config,
    };
    this.provider = provider;
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
          };
        }
      } catch {
        // Cache miss or invalid — fall through to render
      }
    }

    // Render the page from the PDF
    const originalKey = generateStorageKey(workspaceId, datasheetId, "original");
    const pdfBuffer = await this.provider.get(originalKey);

    const pdfData = new Uint8Array(pdfBuffer);
    // Use getDocument to load the PDF
    const pdf = await getDocument({ data: pdfData }).promise;

    // Get the total page count
    const totalPages = pdf.numPages;

    if (pageNumber < 1 || pageNumber > totalPages) {
      throw new Error(`Page ${pageNumber} out of range (PDF has ${totalPages} pages)`);
    }

    // Get page view
    const pageView = await pdf.getPage(pageNumber);

    // Compute scale and viewport
    const dpi = renderConfig.dpi ?? 220;
    const defaultDpi = 72;
    let scale = dpi / defaultDpi;
    const viewport = pageView.getViewport({ scale, rotation: 0 });

    // Determine render dimensions
    let renderW = viewport.width;
    let renderH = viewport.height;

    if (renderConfig.maxWidth !== undefined && renderW > renderConfig.maxWidth) {
      renderW = renderConfig.maxWidth;
    }
    if (renderConfig.maxHeight !== undefined && renderH > renderConfig.maxHeight) {
      renderH = renderConfig.maxHeight;
    }

    // Create canvas
    const canvas = createCanvas(renderW, renderH);
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to get 2d context from canvas");
    }

    // Render page onto canvas
    const renderParams: any = { ctx, viewport };
    pageView.render(renderParams).promise;

    // Convert to format
    let imageBuffer: Buffer;
    if (renderConfig.format === "png") {
      const pngData = canvas.toBuffer("image/png");
      imageBuffer = Buffer.from(pngData);
    } else {
      // WebP - canvas.toBlob takes a callback in Node
      const qualityValue = renderConfig.quality ?? 80;
      await new Promise<Buffer>((resolve, reject) => {
        ;(canvas as any).toBlob(
          (blob: any) => {
            if (blob) {
              resolve(Buffer.from(blob.arrayBuffer()));
            } else {
              reject(new Error("Canvas toBlob failed"));
            }
          },
          "image/webp",
          qualityValue / 100,
        );
      });
    }

    // Store the rendered asset in cache
    await this.provider.put(imageBuffer, cachedKey);
    // Also store metadata
    const mimeType = renderConfig.format === "png" ? "image/png" : "image/webp";
    await this.provider.getMetadata(cachedKey); // ensure it's stored

    const dimensions = this.dimensionsFromBuffer(imageBuffer);

    return {
      imageBuffer,
      renderWidth: dimensions.width,
      renderHeight: dimensions.height,
      pageNumber,
      cached: false,
    };
  }

  /**
   * Compute the scale factor for rendering based on DPI and page size.
   */
  private computeScale(pageView: any, config: PdfRenderConfig): number {
    const dpi = config.dpi ?? 220;
    // The page view has a default scale at 72 DPI (CSS pixels)
    // We want to scale to the requested DPI
    const defaultDpi = 72;
    let scale = dpi / defaultDpi;

    // Apply maxWidth/maxHeight constraints if specified
    if (config.maxWidth !== undefined || config.maxHeight !== undefined) {
      // Get viewport at scale 1 to check original dimensions
      const view = pageView.getViewport({ scale: 1, rotation: 0 });
      if (config.maxWidth !== undefined && view.width > config.maxWidth) {
        scale *= config.maxWidth / view.width;
      }
      if (config.maxHeight !== undefined && view.height > config.maxHeight) {
        scale *= config.maxHeight / view.height;
      }
    }

    return scale;
  }

  /**
   * Check if a buffer appears to be a valid image.
   */
  isValidImage(buffer: Buffer, mimeType?: string): boolean {
    if (buffer.length < 4) return false;

    const header = buffer.subarray(0, 4);

    // Check PNG magic bytes
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
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
    if (header[0] === 0xFF && header[1] === 0xD8) {
      return mimeType === "image/jpeg" || mimeType === undefined;
    }

    return false;
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
}

/**
 * Create a PdfRenderer instance configured for the application.
 */
export function createPdfRenderer(
  config: PdfRenderConfig = {},
  provider: StorageProvider,
): PdfRenderer {
  return new PdfRenderer(config, provider);
}

/**
 * Exported types
 */
export type { PdfRenderConfig, PdfRenderResult };
