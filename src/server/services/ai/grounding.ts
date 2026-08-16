/**
 * Grounding context builder for SpecLens Copilot.
 *
 * Builds a compact, bounded context for the Nemotron LLM from retrieved
 * SpecLens evidence. Only includes fields necessary for grounded engineering
 * answers — no entire PDFs, no irrelevant results.
 *
 * Each source contains only the information Nemotron needs to cite and
 * ground its claims, keeping token usage minimal.
 */
import type { Evidence, SearchResult } from "@/types/speclens";

/**
 * Build compact grounding context from a selectContextSet result.
 * Every field is chosen carefully — nothing extraneous is sent to Nemotron.
 */
export function buildGroundingContext(
  contextSet: ReturnType<typeof selectContextSet>,
): {
  componentContext: { mpn: string; manufacturer: string } | null;
  evidence: Array<{
    evidenceId: string;
    documentId: string;
    page: number;
    title: string;
    manufacturer: string;
    mpn: string;
    evidenceType: string;
    snippet: string;
    confidence: number;
    retrievalScore: number;
    bbox: { x: number; y: number; w: number; h: number } | null;
  }>;
  totalItems: number;
} {
  const evidence = contextSet.map((ev) => ({
    evidenceId: ev.evidenceId,
    documentId: ev.documentId,
    page: ev.page,
    title: ev.title,
    manufacturer: ev.manufacturer,
    mpn: "", // not in contextSet; populated at component level if available
    evidenceType: ev.type,
    snippet: ev.caption || "",
    confidence: ev.confidence,
    retrievalScore: ev.retrievalScore,
    bbox: ev.bbox || null,
  }));

  return {
    componentContext: contextSet.length > 0
      ? {
          mpn: contextSet[0].mpn || "",
          manufacturer: contextSet[0].manufacturer || "",
        }
      : null,
    evidence,
    totalItems: contextSet.length,
  };
}

/**
 * Extract a single source reference for the structured response.
 * Mirrors the frontend SourceReference contract while using grounded data.
 */
export function buildSourceReference(
  ev: ReturnType<typeof buildGroundingContext>["evidence"][number],
): {
  evidenceId: string;
  page: number;
  label: string;
  confidence: number;
} {
  return {
    evidenceId: ev.evidenceId,
    page: ev.page,
    label: ev.title,
    confidence: ev.confidence,
  };
}