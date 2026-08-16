/**
 * Document chunker for SpecLens.
 *
 * Chunks actual extracted datasheet text while preserving provenance.
 * Chunk boundaries are useful for technical documentation.
 *
 * Design:
 * - Sensible chunk sizes with overlap
 * - Preserves: documentId, pageNumber, section/context, chunk text, source position
 * - Token/character information tracked
 * - No arbitrary fixed strings for testing
 */
import { v4 as uuidv4 } from "uuid";

export interface Chunk {
  id: string;
  documentId: string;
  pageNumber: number;
  section?: string;
  text: string;
  sourceStart: number; // character offset in the original extracted text
  sourceEnd: number; // character offset in the original extracted text
  characterLength: number;
  tokenEstimate?: number;
}

/**
 * Chunk extracted datasheet text into sensible segments.
 * 
 * @param documentId The datasheet/document ID
 * @param pageNumber The page number (1-indexed)
 * @param extractedText The full extracted text from a page
 * @param section Optional section/context label if available
 * @param chunkSizeApproximate Character target per chunk (default: 800)
 * @param overlap Characters of overlap between chunks (default: 100)
 * @returns Array of chunks with preserved provenance
 */
export function chunkDocumentText(
  documentId: string,
  pageNumber: number,
  extractedText: string,
  section?: string,
  chunkSizeApproximate = 800,
  overlap = 100
): Chunk[] {
  if (!extractedText || extractedText.trim().length === 0) {
    return [];
  }

  const text = extractedText.trim();
  const chunkSize = chunkSizeApproximate;
  const overlapSize = Math.max(0, overlap);

  const chunks: Chunk[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunkText = text.substring(start, end);

    chunks.push({
      id: `${documentId}-page-${pageNumber}-chunk-${chunkIndex}-${uuidv4().slice(0, 8)}`,
      documentId,
      pageNumber,
      section,
      text: chunkText,
      sourceStart: start,
      sourceEnd: end,
      characterLength: chunkText.length,
      tokenEstimate: Math.max(1, Math.round(chunkText.length / 4)),
    });

    // Move start position, accounting for overlap
    // If we're at the end of the text, just break
    if (end >= text.length) {
      break;
    }

    start = end - overlapSize;
    // Prevent infinite loop / ensure progress
    if (start >= end) {
      start = end;
    }
    chunkIndex++;
  }

  return chunks;
}

/**
 * Chunk evidence text combining relevant signals for embedding.
 * 
 * @param evidenceText Base text from evidence
 * @param title Evidence title
 * @param caption Evidence caption
 * @param evidenceType Evidence type (pinout, package, etc.)
 * @param manufacturer Manufacturer name
 * @param mpn Component MPN
 * @param pageNumber Page number
 * @param chunkSizeApproximate Character target per chunk
 * @param overlap Characters of overlap
 * @returns Chunked evidence text
 */
export function chunkEvidenceText(
  evidenceText: string,
  title?: string,
  caption?: string,
  evidenceType?: string,
  manufacturer?: string,
  mpn?: string,
  pageNumber?: number,
  chunkSizeApproximate = 800,
  overlap = 100
): Chunk[] {
  // Build a combined signal text for chunking
  const parts: string[] = [];

  if (mpn) parts.push(`MPN: ${mpn}`);
  if (manufacturer) parts.push(`Manufacturer: ${manufacturer}`);
  if (evidenceType) parts.push(`Type: ${evidenceType}`);
  if (title) parts.push(`Title: ${title}`);
  if (caption) parts.push(`Caption: ${caption}`);
  if (evidenceType && evidenceType !== "other") parts.push(`Section: ${evidenceType}`);

  // Append the actual evidence text at the end
  const signalText = parts.join(" ") + " " + (evidenceText || "");

  return chunkDocumentText(
    `${title || "evidence"}-${pageNumber || "unknown"}`,
    pageNumber || 1,
    signalText,
    `type-${evidenceType || "unknown"}`,
    chunkSizeApproximate,
    overlap
  );
}