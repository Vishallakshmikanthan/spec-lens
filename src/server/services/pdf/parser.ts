/**
 * PDF parsing service.
 *
 * Uses pdf-parse for initial validation, page count, and metadata,
 * and pdfjs-dist for per-page text extraction.
 *
 * Architecture:
 *   Server-side only — never imported into browser components.
 *   Reads the PDF from the storage provider.
 *   Output: structured page data with text, metadata, page count.
 */
import parse from "pdf-parse";
import { PDFDocumentProxy, getDocument } from "pdfjs-dist";
import { StorageProvider } from "@/storage/provider";
import { generateStorageKey } from "@/storage/local";

const MAX_PAGES = 500;

/**
 * Result of parsing a PDF buffer.
 *
 * Contains page count, metadata, and page-level information extracted
 * from the PDF. Per-page text promises are created separately using
 * createPageTextPromises() for better control over reading order.
 */
export interface ParsedPdf {
  pageCount: number;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modificationDate?: string;
  };
  info: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modificationDate?: string;
    PageSize?: string;
  };
}

/**
 * Internal interface for pdf-parse result parsing.
 */
interface PdfParseInfo {
  numPages: number;
  info: any;
  metadata: any;
}

/**
 * Parse a PDF buffer and extract comprehensive information.
 *
 * Uses pdf-parse for quick metadata and page count, with a pdfjs-dist
 * fallback for page count if pdf-parse fails.
 *
 * The PDF is NOT read from storage inside this function — the caller
 * must pass the file buffer. Page text is extracted separately via
 * createPageTextPromises() which takes workspace/datasheet context.
 */
export async function parsePdf(fileBuffer: Buffer): Promise<ParsedPdf> {
  // Step 1: Use pdf-parse for quick metadata and page count
  let pdfInfo: PdfParseInfo = {
    numPages: 0,
    info: {},
    metadata: {},
  };

  try {
    const parseResult = await new Promise((resolve, reject) => {
      parse(fileBuffer, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    pdfInfo = {
      numPages: parseResult?.numPages ?? 0,
      info: parseResult?.info ?? {},
      metadata: parseResult?.metadata ?? {},
    };
  } catch (error) {
    // If pdf-parse fails, fall back to pdfjs-dist for page count
    const fallback = await fallbackParseWithPdfjs(fileBuffer);
    pdfInfo.numPages = fallback.numPages;
    pdfInfo.info = fallback.info;
    pdfInfo.metadata = fallback.metadata;
  }

  const pageCount = Math.min(Math.max(pdfInfo.numPages || 0, 0), MAX_PAGES);

  // Step 2: Extract metadata
  const metadata = {
    title: pdfInfo.metadata?.title,
    author: pdfInfo.metadata?.author,
    subject: pdfInfo.metadata?.subject,
    creator: pdfInfo.metadata?.creator,
    producer: pdfInfo.metadata?.producer,
    creationDate: pdfInfo.metadata?.creationDate,
    modificationDate: pdfInfo.metadata?.modificationDate,
  };

  // Step 3: Extract page-level info (PageSize)
  const info = {
    title: pdfInfo.info?.Title,
    author: pdfInfo.info?.Author,
    subject: pdfInfo.info?.Subject,
    creator: pdfInfo.info?.Creator,
    producer: pdfInfo.info?.Producer,
    creationDate: pdfInfo.info?.CreationDate,
    modificationDate: pdfInfo.info?.ModDate,
    PageSize: pdfInfo.info?.PageSize,
  };

  return {
    pageCount,
    metadata,
    info,
  };
}

/**
 * Fallback PDF parsing using only pdfjs-dist when pdf-parse fails.
 */
async function fallbackParseWithPdfjs(
  fileBuffer: Buffer,
): Promise<{ numPages: number; info: any; metadata: any }> {
  const pdfData = new Uint8Array(fileBuffer);
  const pdf = await getDocument({ data: pdfData }).promise;
  const totalPages = pdf.numPages;

  // Get basic info if available
  let info = {};
  let metadata = {};

  try {
    const pdfInfo = await pdf.getMetadata().promise;
    info = pdfInfo;
  } catch {
    // metadata may not be available
  }

  try {
    const pdfMeta = await pdf.getMetadata().promise;
    metadata = pdfMeta;
  } catch {
    // metadata may not be available
  }

  return { numPages: totalPages, info, metadata };
}

/**
 * Create per-page text extraction promises for a PDF.
 *
 * Each promise resolves to { pageNumber, text } for the corresponding page.
 * Text is extracted using pdfjs-dist's getTextContent() API, which provides
 * tokens in reading order. Whitespace is preserved where meaningful.
 *
 * @param workspaceId - The workspace ID
 * @param datasheetId - The datasheet ID
 * @param provider - Storage provider for accessing the PDF
 * @returns Array of promises, one per page
 */
export async function createPageTextPromises(
  workspaceId: string,
  datasheetId: string,
  provider: StorageProvider,
): Promise<Array<Promise<{ pageNumber: number; text: string }>>> {
  // Read the original PDF from storage
  const originalKey = generateStorageKey(workspaceId, datasheetId, "original");
  const pdfBuffer = await provider.get(originalKey);
  const pdfData = new Uint8Array(pdfBuffer);

  // Load the PDF using pdfjs-dist
  const pdf = await getDocument({ data: pdfData }).promise;
  const totalPages = pdf.numPages;

  const promises: Array<Promise<{ pageNumber: number; text: string }>> = [];

  for (let i = 1; i <= totalPages; i++) {
    promises[i - 1] = (async () => {
      try {
        const pageView = await pdf.getPage(i);
        const textContent = await pageView.getTextContent();

        // Build a text string from the content items
        // pdfjs-dist returns an array of { str, width, height, ... } objects
        const textItems = textContent.items;
        const words: string[] = [];

        for (const item of textItems) {
          // Add the word text
          words.push(item.str);
          // Add a space if this isn't the last item and there's a gap
          const nextIndex = textItems.indexOf(item) + 1;
          if (nextIndex < textItems.length) {
            const nextItem = textItems[nextIndex];
            // Simple heuristic: if there's a significant gap, add space
            const currentX = item.transform ? item.transform[4] : item.x || 0;
            const nextX = nextItem.transform ? nextItem.transform[4] : nextItem.x || 0;
            // If there's a gap larger than a typical word width, add space
            if (typeof currentX === "number" && typeof nextX === "number") {
              if (nextX - currentX > 100) {
                words.push(" ");
              }
            } else {
              words.push(" ");
            }
          }
        }

        const text = words.join("").trim();
        return { pageNumber: i, text };
      } catch (error) {
        // If page text extraction fails, return empty text
        console.error(`Text extraction failed for page ${i}:`, error);
        return { pageNumber: i, text: "" };
      }
    })();
  }

  return promises;
}