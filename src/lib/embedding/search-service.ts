/**
 * SearchService.
 *
 * Orchestrates the full search pipeline:
 * 1. Validate request
 * 2. Embed query (text or visual)
 * 3. Retrieve similar evidence via pgvector (text or visual)
 * 4. Merge candidates for hybrid mode
 * 5. Normalize scores across candidate pool
 * 6. Apply deterministic ranking with metadata boosts
 * 7. Calculate facet counts from filtered result universe
 * 8. Apply pagination
 * 9. Record search history
 * 10. Return SearchResultSet
 *
 * Keeps ranking logic separate from HTTP route (per architecture requirements).
 * Supports text, visual, and hybrid search modes.
 */
import { z } from "zod";
import { SearchResultSet, SearchFilters, Evidence } from "@/types/speclens";
import { retrieveSimilarEvidence } from "./retriever";
import { retrieveVisualSimilarEvidence } from "../visual-embedding/retriever";
import { deterministicRanker } from "./retriever";
import { normalizeCandidatePool } from "./normalization";
import { DeterministicReranker, RerankerConfig } from "./reranker";
import { evidenceEmbeddings, evidence, workspaces, searchHistory } from "@/database/schema";
import { db } from "@/lib/db";
import { eq, sql, and } from "drizzle-orm";
import type { EmbeddingProvider, EmbeddingConfig } from "./provider";
import type { VisualEmbeddingProvider, VisualEmbeddingConfig } from "../visual-embedding/provider";
import type { HybridCandidate } from "../embedding/hybrid-retriever";
import { detectIntent, QueryIntent } from "./query-intent";

const SearchSchema = z.object({
  query: z.string().min(1).max(500),
  mode: z.enum(["text", "visual", "hybrid"]).default("text"),
  types: z.array(z.string()).optional(),
  manufacturer: z.string().optional(),
  documentId: z.number().optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional().default(20),
  // Visual search input - only used in visual/hybrid mode
  visualQuery: z.instanceof(File).optional(),
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
 *  2. Detect query intent
 *  3. Embed the query text (or visual query if provided)
 *  4. Retrieve similar evidence with filters
 *  5. For hybrid mode: merge text + visual candidates, deduplicate, normalize
 *  6. Apply deterministic ranking with metadata boosts
 *  7. Calculate facet counts from the filtered universe
 *  8. Return SearchResultSet with pagination
 */
export async function executeSearch(
  input: SearchInput,
  workspaceId: number,
  provider: EmbeddingProvider,
  config: EmbeddingConfig = { model: "nvidia/nemotron", dimension: 384, metric: "cosine" },
  visualProvider?: VisualEmbeddingProvider,
  visualConfig: VisualEmbeddingConfig = { model: "local-visual", dimension: 384, metric: "cosine" }
) {
  // Step 1: Validate input
  const validated = SearchSchema.parse(input);

  // Step 2: Detect query intent
  const intentResult = detectIntent(validated.query);
  const queryIntent = intentResult.intent;

  // Step 3: Embed the query
  let queryEmbedding: number[];
  if (validated.mode === "visual" || validated.mode === "hybrid") {
    // Visual search mode - embed the query image
    if (!validated.visualQuery) {
      throw new Error("visualQuery is required for visual/hybrid search mode");
    }
    const { buffer } = await preprocessImageForEmbedding(validated.visualQuery);
    queryEmbedding = buffer; // Use buffer as embedding for visual provider
  } else {
    // Text mode - embed the query text
    queryEmbedding = await provider.embedText(validated.query);
  }

  // Step 4: Retrieve similar evidence based on mode
  let retrievalResults: any[];
  if (validated.mode === "text") {
    // Text-only retrieval
    const retrieval = await retrieveSimilarEvidence(
      validated.query,
      workspaceId,
      {
        ...provider,
        embedText: (text: string) => provider.embedText(text),
      },
      {
        evidenceTypes: validated.types,
        manufacturers: validated.manufacturer ? [validated.manufacturer] : undefined,
        documentIds: validated.documentId ? [validated.documentId] : undefined,
        minConfidence: validated.minConfidence,
        page: validated.page,
        pageSize: validated.pageSize,
      },
      config
    );
    retrievalResults = retrieval.results;
  } else if (validated.mode === "visual") {
    // Visual-only retrieval
    const retrieval = await retrieveVisualSimilarEvidence(
      queryEmbedding as number[],
      workspaceId,
      visualProvider || ({ embedImage: () => Promise.resolve([]) } as VisualEmbeddingProvider),
      visualConfig,
      {
        evidenceTypes: validated.types,
        manufacturers: validated.manufacturer ? [validated.manufacturer] : undefined,
        documentIds: validated.documentId ? [validated.documentId] : undefined,
        minConfidence: validated.minConfidence,
        page: validated.page,
        pageSize: validated.pageSize,
      }
    );
    retrievalResults = retrieval.results;
  } else {
    // Hybrid mode: text + visual retrieval
    // Retrieve text candidates
    const textRetrieval = await retrieveSimilarEvidence(
      validated.query,
      workspaceId,
      {
        ...provider,
        embedText: (text: string) => provider.embedText(text),
      },
      {
        evidenceTypes: validated.types,
        manufacturers: validated.manufacturer ? [validated.manufacturer] : undefined,
        documentIds: validated.documentId ? [validated.documentId] : undefined,
        minConfidence: validated.minConfidence,
        page: validated.page,
        pageSize: validated.pageSize,
      },
      config
    );

    // Retrieve visual candidates (if visual input provided)
    let visualCandidates: any[] = [];
    if (validated.visualQuery) {
      const visualRetrieval = await retrieveVisualSimilarEvidence(
        queryEmbedding as number[],
        workspaceId,
        visualProvider || ({ embedImage: () => Promise.resolve([]) } as VisualEmbeddingProvider),
        visualConfig,
        {
          evidenceTypes: validated.types,
          manufacturers: validated.manufacturer ? [validated.manufacturer] : undefined,
          documentIds: validated.documentId ? [validated.documentId] : undefined,
          minConfidence: validated.minConfidence,
          page: validated.page,
          pageSize: validated.pageSize,
        }
      );
      visualCandidates = visualRetrieval.results;
    }

    // Merge candidates from both lanes
    const candidateMap = new Map<number, HybridCandidate>();

    // Add text candidates
    for (const r of textRetrieval.results) {
      candidateMap.set(r.evidence.id, {
        evidence: r.evidence,
        textScore: r.similarity,
        visualScore: undefined,
        evidenceType: r.evidence.evidenceType,
        manufacturer: r.evidence.manufacturer,
        mpn: r.evidence.mpn,
      });
    }

    // Add visual candidates
    for (const r of visualCandidates) {
      const existing = candidateMap.get(r.evidence.id);
      if (existing) {
        existing.visualScore = r.visualSimilarity;
        existing.evidenceType = r.evidence.evidenceType;
        existing.manufacturer = r.evidence.manufacturer;
        existing.mpn = r.evidence.mpn;
      } else {
        candidateMap.set(r.evidence.id, {
          evidence: r.evidence,
          textScore: undefined,
          visualScore: r.visualSimilarity,
          evidenceType: r.evidence.evidenceType,
          manufacturer: r.evidence.manufacturer,
          mpn: r.evidence.mpn,
        });
      }
    }

    retrievalResults = Array.from(candidateMap.values());
  }

  // Step 5: For hybrid mode, normalize scores and rerank
  let evidenceCandidates: Array<{ evidence: Evidence; similarityScore: number }>;
  let normalized: any;

  if (validated.mode === "hybrid" && retrievalResults.some(c => c.textScore !== undefined || c.visualScore !== undefined)) {
    // Normalize scores across the candidate pool
    const mergedCandidates = retrievalResults.map((c: any) => ({
      evidence: c.evidence,
      textScore: c.textScore,
      visualScore: c.visualScore,
    }));

    const normalizedResult = normalizeCandidatePool(mergedCandidates);
    normalized = normalizedResult.normalized;

    // Map to format expected by reranker
    const normalizedCandidates = normalizedResult.candidates.map((c: any) => ({
      evidence: c.evidence,
      normalizedText: c.normalizedText,
      normalizedVisual: c.normalizedVisual,
    }));

    // Rerank using deterministic reranker
    const reranker = new DeterministicReranker(undefined, {
      textWeight: 0.5,
      visualWeight: 0.3,
      metadataWeight: 0.2,
      exactMatchBoost: 0.1,
      manufacturerMatchBoost: 0.05,
    });

    const reranked = reranker.rerank(
      normalizedCandidates,
      undefined,
      queryIntent
    );

    // Map reranked results to evidence candidates with retrievalScore
    evidenceCandidates = reranked.map(r => ({
      evidence: r.evidence,
      similarityScore: r.finalScore,
    }));
  } else {
    // Non-hybrid mode: map results and run deterministic ranker
    evidenceCandidates = retrievalResults.map(r => ({
      evidence: r.evidence,
      similarityScore: r.similarity as number,
    }));

    const ranked = deterministicRanker(
      evidenceCandidates,
      {
        exactMpnMatch: null,
        manufacturerMatch: validated.manufacturer || null,
        evidenceTypeMatch: validated.types?.[0] || null,
      }
    );

    // Extract just the evidence candidates (already ranked)
    evidenceCandidates = ranked.map(r => ({
      evidence: r.evidence,
      similarityScore: r.retrievalScore,
    }));
  }

  // Step 6: Deterministic ranking with metadata boosts
  // (Already handled in hybrid mode above, or for text/visual modes below)

  if (validated.mode !== "hybrid") {
    // For text/visual modes, the ranking was already applied above
    // We just need to ensure evidenceCandidates is properly set
  }

  // Step 5 (for non-hybrid): Calculate facet counts from the filtered result universe
  const facetCounts = await calculateFacets(
    workspaceId,
    {
      types: validated.types,
      manufacturer: validated.manufacturer,
      documentId: validated.documentId,
      minConfidence: validated.minConfidence,
      page: validated.page,
      pageSize: validated.pageSize,
    },
    config
  );

  // Step 7: Record search history
  await db.insert(searchHistory).values({
    workspaceId,
    query: validated.query,
    mode: validated.mode,
    filters: JSON.stringify({
      types: validated.types,
      manufacturer: validated.manufacturer,
      documentId: validated.documentId,
      minConfidence: validated.minConfidence,
      page: validated.page,
    }),
    resultCount: evidenceCandidates.length,
  });

  // Step 8: Return SearchResultSet
  const searchResultSet: SearchResultSet = {
    query: validated.query,
    latencyMs: 0, // would be measured in real implementation
    total: evidenceCandidates.length,
    results: evidenceCandidates.map(r => ({
      evidence: r.evidence,
      similarity: r.similarity,
      confidence: r.confidence || 0.5,
      document: null, // would extract from evidence relationship
      page: r.evidence.pageNumber,
      cropUri: r.evidence.cropStorageKey ? `/api/crop/${r.evidence.id}` : null,
      metadata: {
        mpn: r.evidence.mpn,
        manufacturer: r.evidence.manufacturer,
        evidenceType: r.evidence.evidenceType,
      },
      retrievalScore: r.similarity,
    })),
    facets: facetCounts,
  };

  return searchResultSet;
}

/**
 * Preprocess a query image file for embedding.
 * Reads the file as a buffer - the embedding provider handles internal preprocessing.
 */
async function preprocessImageForEmbedding(
  imageFile: File
): Promise<{ buffer: Buffer; width: number; height: number }> {
  // Read file as array buffer then convert to Buffer
  const arrayBuffer = await imageFile.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Validate file size
  const MAX_QUERY_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
  if (buffer.length > MAX_QUERY_IMAGE_SIZE) {
    throw new Error(`Image size exceeds maximum of ${MAX_QUERY_IMAGE_SIZE / (1024 * 1024)}MB`);
  }

  // Validate MIME type
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
async function calculateFacets(
  workspaceId: number,
  validated: {
    types?: string[];
    manufacturer?: string;
    documentId?: number;
    minConfidence?: number;
    page?: number;
    pageSize?: number;
    mode?: string;
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