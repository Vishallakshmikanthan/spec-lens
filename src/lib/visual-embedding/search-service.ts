/**
 * VisualSearchService.
 *
 * Orchestrates the full visual search pipeline:
 * 1. Validate request
 * 2. Embed query image via provider
 * 3. Retrieve similar evidence via pgvector visual similarity
 * 4. Apply visual ranker with metadata boosts
 * 5. Calculate facet counts from filtered result universe
 * 6. Return VisualSearchResultSet with pagination
 *
 * Keeps visual ranking logic separate from HTTP route (per architecture requirements).
 * Maintains visualSimilarity separate from confidence and textRetrievalScore.
 */
import { z } from "zod";
import { VisualSearchResultSet, VisualSearchFilters, Evidence } from "@/types/speclens";
import { retrieveVisualSimilarEvidence } from "./retriever";
import { visualRanker } from "./retriever";
import { evidenceEmbeddings, evidence, workspaces, searchHistory } from "@/database/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

const VisualSearchSchema = z.object({
  image: z.instanceof(File).refine((file) => {
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    return allowedTypes.includes(file.type);
  }, "Unsupported image type. Please use PNG, JPEG, or WEBP."),
  filters: z.object({
    types: z.array(z.string()).optional(),
    manufacturer: z.string().optional(),
    documentId: z.number().optional(),
    minConfidence: z.number().min(0).max(1).optional(),
    page: z.number().int().positive().optional(),
    pageSize: z.number().int().positive().optional().default(20),
  }).optional(),
});

export type VisualSearchInput = z.infer<typeof VisualSearchSchema>;

export interface VisualSearchResult {
  evidence: Evidence;
  visualSimilarity: number; // pgvector visual similarity (0-1, higher=better)
  confidence: number; // evidence confidence (separate concept)
  retrievalScore: number; // base visual similarity before boosts
}

export interface VisualSearchResultSet {
  queryImageId: string;
  latencyMs: number;
  total: number;
  results: VisualSearchResult[];
  facets: { type: string; count: number }[];
}

/**
 * Execute a real visual search.
 *
 * Steps:
 *  1. Validate input using Zod schema
 *  2. Preprocess and embed the query image
 *  3. Perform pgvector visual similarity search with workspace isolation
 *  4. Apply visual ranker with metadata boosts
 *  5. Calculate facet counts from the filtered universe
 *  6. Return VisualSearchResultSet with pagination
 */
export async function executeVisualSearch(
  input: VisualSearchInput,
  workspaceId: number,
  provider: VisualEmbeddingProvider,
  config: {
    model: string;
    dimension: number;
    metric: "cosine" | "l2" | "ip";
  } = { model: "local-visual", dimension: 384, metric: "cosine" }
) {
  // Step 1: Validate input
  const validated = VisualSearchSchema.parse(input);

  const startTime = Date.now();

  // Step 2: Preprocess and embed the query image
  const { buffer } = await preprocessImageForEmbedding(validated.image);

  // Step 3: Retrieve similar evidence with filters
  const retrieval = await retrieveVisualSimilarEvidence(
    buffer, // Using buffer as the embedding query (model-specific preprocessing)
    workspaceId,
    provider,
    config,
    validated.filters
  );

  // Step 4: Visual ranker with metadata boosts
  // Map retrieval results to evidence type for the ranker
  const evidenceCandidates = retrieval.results.map(r => ({
    evidence: r.evidence,
    visualSimilarityScore: r.visualSimilarity,
  }));

  const ranked = visualRanker(
    evidenceCandidates,
    {
      exactMpnMatch: null,
      manufacturerMatch: validated.filters?.manufacturer || null,
      evidenceTypeMatch: validated.filters?.types?.[0] || null,
    }
  );

  // Step 5: Calculate facet counts from the filtered result universe
  const facetCounts = await calculateVisualFacets(
    workspaceId,
    validated.filters
  );

  const latencyMs = Date.now() - startTime;

  // Step 6: Record search history
  await db.insert(searchHistory).values({
    workspaceId,
    query: `visual-search:${validated.filters?.types?.join(',') || 'unknown'}`,
    filters: JSON.stringify({
      types: validated.filters?.types,
      manufacturer: validated.filters?.manufacturer,
      documentId: validated.filters?.documentId,
      minConfidence: validated.filters?.minConfidence,
      page: validated.filters?.page,
    }),
    resultCount: ranked.length,
  });

  // Step 7: Return VisualSearchResultSet
  const searchResultSet: VisualSearchResultSet = {
    queryImageId: validated.image.name || 'unknown',
    latencyMs,
    total: ranked.length,
    results: ranked.map(r => ({
      evidence: r.evidence,
      visualSimilarity: r.visualSimilarity,
      confidence: r.confidence,
      retrievalScore: r.retrievalScore,
    })),
    facets: facetCounts,
  };

  return searchResultSet;
}

/**
 * Preprocess a query image file for embedding.
 * - Validates MIME type
 * - Reads the file as a buffer
 * - Returns the buffer for the embedding provider
 */
async function preprocessImageForEmbedding(
  imageFile: File
): Promise<{ buffer: Buffer; width: number; height: number }> {
  // Read file as array buffer then convert to Buffer
  const arrayBuffer = await imageFile.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Validate file size
  if (buffer.length > SUPPORTED_QUERY_IMAGE_SIZE) {
    throw new Error(`Image size exceeds maximum of ${SUPPORTED_QUERY_IMAGE_SIZE / (1024 * 1024)}MB`);
  }

  // Validate MIME type (already done by Zod, but double-check)
  const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
  if (!allowedTypes.includes(imageFile.type)) {
    throw new Error(`Unsupported image type: ${imageFile.type}`);
  }

  // For now, return the raw buffer.
  // The embedding provider will handle its own internal preprocessing.
  // We preserve the original buffer without modifying the original file.
  return {
    buffer,
    width: imageFile.width || 0,
    height: imageFile.height || 0,
  };
}

/**
 * Calculate facet counts from the filtered evidence universe.
 * Returns counts for: evidence types, manufacturers, page numbers.
 */
async function calculateVisualFacets(
  workspaceId: number,
  filters?: {
    types?: string[];
    manufacturer?: string;
    documentId?: number;
    minConfidence?: number;
    page?: number;
    pageSize?: number;
  }
) {
  // Base query: evidence in workspace with visual embeddings
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

  if (filters) {
    if (filters.types && filters.types.length > 0) {
      filtered = filtered.where(
        sql`${evidence.evidenceType} = ANY(${filters.types})`
      );
    }
    if (filters.manufacturer) {
      filtered = filtered.where(
        sql`${evidence.manufacturer} = ${filters.manufacturer}`
      );
    }
    if (filters.documentId) {
      filtered = filtered.where(
        sql`${evidence.datasheetId} = ${filters.documentId}`
      );
    }
    if (filters.minConfidence !== undefined) {
      filtered = filtered.where(
        sql`${evidence.confidence} >= ${filters.minConfidence}`
      );
    }
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