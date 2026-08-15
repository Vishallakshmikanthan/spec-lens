/**
 * SearchService.
 *
 * Orchestrates the full search pipeline:
 * 1. Validate request
 * 2. Embed query
 * 3. Retrieve similar evidence via pgvector
 * 4. Apply deterministic ranking with metadata boosts
 * 5. Calculate facet counts from filtered result universe
 * 6. Apply pagination
 * 7. Record search history
 *
 * Keeps ranking logic separate from HTTP route (per architecture requirements).
 */
import { z } from "zod";
import { SearchResultSet, SearchFilters, Evidence } from "@/types/speclens";
import { retrieveSimilarEvidence } from "./retriever";
import { deterministicRanker } from "./retriever";
import { evidenceEmbeddings, evidence, workspaces, searchHistory } from "@/database/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

const SearchSchema = z.object({
  query: z.string().min(1).max(500),
  types: z.array(z.string()).optional(),
  manufacturer: z.string().optional(),
  documentId: z.number().optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional().default(20),
});

export type SearchInput = z.infer<typeof SearchSchema>;

export interface SearchResult {
  evidence: Evidence;
  retrievalScore: number; // pgvector similarity (0-1, higher=better)
  confidence: number; // evidence confidence (separate concept)
}

/**
 * Execute a real semantic search.
 *
 * Steps:
 *  1. Validate input using Zod schema
 *  2. Embed the query text
 *  3. Perform pgvector similarity search with workspace isolation
 *  4. Apply deterministic ranking with metadata boosts
 *  5. Calculate facet counts from the filtered universe
 *  6. Return SearchResultSet with pagination
 */
export async function executeSearch(
  input: SearchInput,
  workspaceId: number,
  provider: EmbeddingProvider,
  config: EmbeddingConfig = { model: "nvidia/nemotron", dimension: 384, metric: "cosine" }
) {
  // Step 1: Validate input
  const validated = SearchSchema.parse(input);

  // Step 2: Embed the query text
  const queryEmbedding = await provider.embedText(validated.query);

  // Step 3: Retrieve similar evidence with filters
  const retrieval = await retrieveSimilarEvidence(
    validated.query,
    workspaceId,
    {
      evidenceTypes: validated.types,
      manufacturers: validated.manufacturer ? [validated.manufacturer] : undefined,
      documentIds: validated.documentId ? [validated.documentId] : undefined,
      minConfidence: validated.minConfidence,
      page: validated.page,
      pageSize: validated.pageSize,
    },
    provider,
    config
  );

  // Step 4: Deterministic ranking with metadata boosts
  // Map retrieval results to Evidence type for the ranker
  const evidenceCandidates = retrieval.results.map(r => ({
    evidence: r.evidence,
    similarityScore: r.similarity,
  }));

  const ranked = deterministicRanker(
    evidenceCandidates,
    {
      exactMpnMatch: null,
      manufacturerMatch: validated.manufacturer || null,
      evidenceTypeMatch: validated.types?.[0] || null,
    }
  );

  // Step 5: Calculate facet counts from the filtered result universe
  // Facets: evidence type, manufacturer, page numbers
  const facetCounts = await calculateFacets(
    workspaceId,
    validated,
    config
  );

  // Step 6: Record search history
  await db.insert(searchHistory).values({
    workspaceId,
    query: validated.query,
    filters: JSON.stringify({
      types: validated.types,
      manufacturer: validated.manufacturer,
      documentId: validated.documentId,
      minConfidence: validated.minConfidence,
      page: validated.page,
    }),
    resultCount: ranked.length,
  });

  // Step 7: Return SearchResultSet
  const searchResultSet: SearchResultSet = {
    query: validated.query,
    latencyMs: 0, // would be measured in real implementation
    total: ranked.length,
    results: ranked.map(r => ({
      evidence: r.evidence,
      similarity: r.retrievalScore,
      confidence: r.confidence,
      document: null, // would extract from evidence relationship
      page: r.evidence.pageNumber,
      cropUri: r.evidence.cropStorageKey ? `/api/crop/${r.evidence.id}` : null,
      metadata: {
        mpn: r.evidence.mpn,
        manufacturer: r.evidence.manufacturer,
        evidenceType: r.evidence.evidenceType,
      },
      retrievalScore: r.retrievalScore,
    })),
    facets: facetCounts,
  };

  return searchResultSet;
}

/**
 * Calculate facet counts from the filtered evidence universe.
 * Returns counts for: evidence types, manufacturers, page numbers.
 */
async function calculateFacets(
  workspaceId: number,
  validated: {
    types?: string[];
    manufacturer?: string;
    documentId?: number;
    minConfidence?: number;
    page?: number;
    pageSize?: number;
  },
  config: EmbeddingConfig
) {
  // Base query: evidence in workspace with embeddings
  // Select only the columns we need for facets
  const baseQuery = db.select({
    evidenceType: evidence.evidenceType,
    manufacturer: evidence.manufacturer,
    pageNumber: evidence.pageNumber,
  })
    .from(evidenceEmbeddings)
    .leftJoin(evidence, eq(evidenceEmbeddings.evidenceId, evidence.id))
    .where(evidence.workspaceId === workspaceId);

  // Apply same filters as search for accurate facet counts
  let filtered = baseQuery;

  if (validated.types && validated.types.length > 0) {
    filtered = filtered.where(
      sql`${evidence.evidenceType} = ANY(${validated.types})`
    );
  }
  if (validated.manufacturer) {
    filtered = filtered.where(
      sql`${evidence.manufacturer} = ${validated.manufacturer}`
    );
  }
  if (validated.documentId) {
    filtered = filtered.where(
      sql`${evidence.datasheetId} = ${validated.documentId}`
    );
  }
  if (validated.minConfidence !== undefined) {
    filtered = filtered.where(
      sql`${evidence.confidence} >= ${validated.minConfidence}`
    );
  }

  const rows = await filtered;

  // Count facets
  const typeCounts = new Map<string, number>();
  const manufacturerCounts = new Map<string, number>();
  const pageCounts = new Map<number, number>();

  for (const row of rows) {
    if (row.evidenceType) {
      typeCounts.set(row.evidenceType, (typeCounts.get(row.evidenceType) || 0) + 1);
    }
    if (row.manufacturer) {
      manufacturerCounts.set(row.manufacturer, (manufacturerCounts.get(row.manufacturer) || 0) + 1);
    }
    if (row.pageNumber !== null && row.pageNumber !== undefined) {
      pageCounts.set(row.pageNumber, (pageCounts.get(row.pageNumber) || 0) + 1);
    }
  }

  // Convert to the expected format by the frontend
  // Frontend expects: { type: EvidenceType; count: number }[]
  // We'll map our facet names to EvidenceType values
  const facets: Array<{ type: string; count: number }> = [];

  for (const [type, count] of typeCounts) {
    facets.push({ type, count });
  }
  for (const [manufacturer, count] of manufacturerCounts) {
    facets.push({ type: `manufacturer:${manufacturer}`, count });
  }
  for (const [page, count] of pageCounts) {
    facets.push({ type: `page:${page}`, count });
  }

  // Sort by count descending
  facets.sort((a, b) => b.count - a.count);

  return facets;
}