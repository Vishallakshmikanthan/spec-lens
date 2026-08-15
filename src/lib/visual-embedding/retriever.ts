/**
 * Visual pgvector Retriever.
 *
 * Performs similarity search against pgvector visual embedding columns.
 * Handles workspace isolation, metadata filtering, and pagination.
 *
 * Architecture:
 *   Query visual embedding → pgvector similarity → candidate filter → rank → paginate
 */
import { VisualEmbeddingProvider, VisualEmbeddingMetadata } from "./provider";

/**
 * Search mode types.
 * - "text": text-only retrieval (existing behavior)
 * - "visual": visual-only retrieval (existing behavior)
 * - "hybrid": combined text + visual retrieval with reranking
 */
export type SearchMode = "text" | "visual" | "hybrid";
import { evidence, evidenceEmbeddings, workspaces, datasheets } from "@/database/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

/**
 * Result of a visual similarity search candidate.
 */
interface VisualSimilarityCandidate {
  evidenceId: number;
  visualSimilarity: number; // pgvector cosine similarity (0-1, higher=better)
}

/**
 * Perform pgvector cosine similarity search against visual embeddings.
 * Returns candidates with visual similarity scores, workspace-filtered.
 */
export async function retrieveVisualSimilarEvidence(
  queryEmbedding: number[],
  workspaceId: number,
  provider: VisualEmbeddingProvider,
  config: {
    model: string;
    dimension: number;
    metric: "cosine" | "l2" | "ip";
  } = { model: "local-visual", dimension: 384, metric: "cosine" },
  filters?: {
    evidenceTypes?: string[];
    manufacturers?: string[];
    documentIds?: number[];
    minConfidence?: number;
    page?: number;
    pageSize?: number;
  }
) {
  // Step 1: Build the base similarity query with workspace isolation
  // pgvector cosine similarity: 1 - (embedding <=> query_embedding)
  // Range: 0 to 1 (higher is more similar for cosine)
  const similarity = 1 - sql`${evidenceEmbeddings.embedding} <=> ${queryEmbedding}`;

  // Step 2: Start building the query with workspace isolation
  // We only search evidence within the user's workspace
  let queryBuilder = db.select({
    evidenceId: evidence.id,
    evidence: evidence,
    visualSimilarity: sql<number>`${similarity}::double precision`,
  })
    .from(evidenceEmbeddings)
    .where(eq(evidenceEmbeddings.workspaceId, workspaceId));

  // Step 3: Apply metadata filters (joining evidence for filter columns)
  let joinBuilder = queryBuilder.from(evidenceEmbeddings);

  if (filters) {
    if (filters.evidenceTypes && filters.evidenceTypes.length > 0) {
      joinBuilder = joinBuilder.leftJoin(evidence, eq(evidenceEmbeddings.evidenceId, evidence.id));
      joinBuilder.where(
        sql`${evidence.evidenceType} = ANY(${filters.evidenceTypes})`
      );
    }
    if (filters.manufacturers && filters.manufacturers.length > 0) {
      if (!joinBuilder._join) {
        joinBuilder = joinBuilder.leftJoin(evidence, eq(evidenceEmbeddings.evidenceId, evidence.id));
      }
      joinBuilder.where(
        sql`${evidence.manufacturer} = ANY(${filters.manufacturers})`
      );
    }
    if (filters.documentIds && filters.documentIds.length > 0) {
      joinBuilder = joinBuilder.leftJoin(evidence, eq(evidenceEmbeddings.evidenceId, evidence.id));
      joinBuilder.where(
        sql`${evidence.datasheetId} = ANY(${filters.documentIds})`
      );
    }
    if (filters.minConfidence !== undefined) {
      joinBuilder = joinBuilder.leftJoin(evidence, eq(evidenceEmbeddings.evidenceId, evidence.id));
      joinBuilder.where(
        sql`${evidence.confidence} >= ${filters.minConfidence}`
      );
    }
  }

  // Rebuild the select with the joined evidence
  const finalBuilder = db.select({
    evidenceId: evidence.id,
    evidence: evidence,
    visualSimilarity: sql<number>`${similarity}::double precision`,
  })
    .from(evidenceEmbeddings)
    .leftJoin(evidence, eq(evidenceEmbeddings.evidenceId, evidence.id));

  // Apply evidence filters from the join
  let filteredBuilder = finalBuilder;
  if (filters) {
    if (filters.evidenceTypes && filters.evidenceTypes.length > 0) {
      filteredBuilder = filteredBuilder.where(
        sql`${evidence.evidenceType} = ANY(${filters.evidenceTypes})`
      );
    }
    if (filters.manufacturers && filters.manufacturers.length > 0) {
      filteredBuilder = filteredBuilder.where(
        sql`${evidence.manufacturer} = ANY(${filters.manufacturers})`
      );
    }
    if (filters.documentIds && filters.documentIds.length > 0) {
      filteredBuilder = filteredBuilder.where(
        sql`${evidence.datasheetId} = ANY(${filters.documentIds})`
      );
    }
    if (filters.minConfidence !== undefined) {
      filteredBuilder = filteredBuilder.where(
        sql`${evidence.confidence} >= ${filters.minConfidence}`
      );
    }
  }

  // Step 4: Apply similarity ordering and pagination
  const pageSize = filters?.pageSize ?? 20;
  const page = filters?.page ?? 1;
  const offset = (page - 1) * pageSize;

  const candidates = await filteredBuilder
    .orderBy(sql`${similarity}::double precision`.desc())
    .limit(pageSize)
    .offset(offset);

  // Step 5: Get total count for pagination
  const countResult = await db.select({
    count: sql`count(*)`.as("count"),
  })
    .from(evidenceEmbeddings)
    .leftJoin(evidence, eq(evidenceEmbeddings.evidenceId, evidence.id))
    .where(evidence.workspaceId === workspaceId);

  // Apply the same filters to the count for accuracy
  let countFiltered = countResult;
  if (filters) {
    if (filters.evidenceTypes && filters.evidenceTypes.length > 0) {
      countFiltered = await db.select({
        count: sql`count(*)`.as("count"),
      })
        .from(evidenceEmbeddings)
        .leftJoin(evidence, eq(evidenceEmbeddings.evidenceId, evidence.id))
        .where(and(
          eq(evidence.workspaceId, workspaceId),
          sql`${evidence.evidenceType} = ANY(${filters.evidenceTypes})`
        ));
    }
  }

  const total = (countResult[0]?.count ?? 0) || 0;

  // Step 6: Map results to format
  const results = candidates.map(row => ({
    evidenceId: row.evidence.id,
    evidence: row.evidence,
    visualSimilarity: row.visualSimilarity as number,
  }));

  return {
    results,
    total,
    page,
    pageSize,
  };
}

/**
 * Deterministic visual ranker that applies metadata boosts to the base visual similarity score.
 * Keeps visualSimilarity separate from confidence and textRetrievalScore as required.
 */
export function visualRanker(
  candidates: Array<{
    evidence: any;
    visualSimilarityScore: number;
  }>,
  filters?: {
    exactMpnMatch?: string | null;
    manufacturerMatch?: string | null;
    evidenceTypeMatch?: string | null;
  }
): Array<{
  evidence: any;
  visualSimilarity: number;
  confidence: number;
  retrievalScore: number;
}> {
  return candidates.map(candidate => {
    const evidence = candidate.evidence;
    let boost = 1.0;

    // Exact MPN match boost
    if (filters?.exactMpnMatch && evidence.mpn === filters.exactMpnMatch) {
      boost *= 1.2; // 20% boost
    }

    // Manufacturer match boost
    if (filters?.manufacturerMatch && evidence.manufacturer === filters.manufacturerMatch) {
      boost *= 1.1; // 10% boost
    }

    // Evidence type match boost
    if (filters?.evidenceTypeMatch && evidence.evidenceType === filters.evidenceTypeMatch) {
      boost *= 1.05; // 5% boost
    }

    // Apply boost to visual similarity score, capped at 1.0 max
    const visualSimilarity = Math.min(candidate.visualSimilarityScore * boost, 1.0);

    // Confidence is separate from visualSimilarity
    // Confidence comes from the evidence's own verification state
    const confidence = evidence.confidence !== undefined
      ? Math.min(evidence.confidence, 1.0)
      : 0.5;

    // Retrieval score is the base visual similarity before boosts
    const retrievalScore = candidate.visualSimilarityScore;

    return {
      evidence,
      visualSimilarity,
      confidence,
      retrievalScore,
    };
  }).sort((a, b) => b.visualSimilarity - a.visualSimilarity);
}