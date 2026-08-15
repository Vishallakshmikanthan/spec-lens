/**
 * HybridRetriever - Combines text and visual retrieval signals.
 *
 * Architecture per the specification:
 *   1. Retrieve top N text candidates (pgvector semantic search)
 *   2. Retrieve top N visual candidates (pgvector visual search) when visual input exists
 *   3. Merge candidates from both lanes
 *   4. Deduplicate by evidence ID (merge scores from both modalities)
 *   5. Calculate metadata signals (exact MPN, manufacturer, evidence type match)
 *   6. Rerank candidates using DeterministicReranker
 *   7. Return top K results
 *
 * Key design decisions:
 * - Text and visual retrieval are separate lanes that can run in parallel
 * - Deduplication merges scores: if the same evidence appears in both lanes,
 *   both textScore and visualScore are populated; if only one lane matches, the
 *   other score is undefined
 * - Normalization is per-candidate-pool (min-max across the candidate pool)
 * - Reranking happens after candidate pool is built, not during retrieval
 * - Query intent detection is used for evidence-type boosting and weight adjustment
 * - Configurable N (candidate fetch limit) and K (result return limit)
 */
import { retrieveSimilarEvidence } from "./retriever";
import { retrieveVisualSimilarEvidence } from "../visual-embedding/retriever";
import { normalizeCandidatePool } from "./normalization";
import { DeterministicReranker, RerankerConfig } from "./reranker";
import { QueryIntent, detectIntent, intentToEvidenceType } from "./query-intent";
import { Evidence } from "@/types/speclens";
import { db } from "@/lib/db";
import { eq, sql, and } from "drizzle-orm";

/**
 * Configuration for hybrid retrieval.
 * N: number of candidates to retrieve per modality
 * K: number of final results to return
 */
export interface HybridRetrieverConfig {
  /** Number of top text candidates to retrieve (default: 50) */
  textCandidateLimit?: number;
  /** Number of top visual candidates to retrieve (default: 50) */
  visualCandidateLimit?: number;
  /** Number of final results to return (default: 20) */
  resultLimit?: number;
  /** Configurable weights for the reranker */
  reranker?: RerankerConfig;
}

/**
 * A candidate evidence result from the hybrid pool.
 * Each candidate may have textScore, visualScore, or both depending on
 * which retrieval lanes matched it.
 */
export interface HybridCandidate {
  evidence: Evidence;
  /** Text similarity score from pgvector cosine (0-1), higher=better */
  textScore?: number;
  /** Visual similarity score from pgvector visual cosine (0-1), higher=better */
  visualScore?: number;
  /** Evidence type from the database */
  evidenceType: string;
  /** Manufacturer from the database */
  manufacturer: string;
  /** MPN from the database */
  mpn: string;
}

/**
 * Merge two candidate pools (text and visual) by deduplicating on evidence ID.
 * When the same evidence appears in both pools, both textScore and visualScore
 * are populated. When it appears in only one, only the relevant score is set.
 *
 * After merging, metadata signals are calculated and the pool is ready for reranking.
 */
export class HybridRetriever {
  private config: HybridRetrieverConfig;

  constructor(config: HybridRetrieverConfig = {}) {
    this.config = {
      textCandidateLimit: config.textCandidateLimit ?? 50,
      visualCandidateLimit: config.visualCandidateLimit ?? 50,
      resultLimit: config.resultLimit ?? 20,
      reranker: config.reranker,
    };
  }

  /**
   * Execute hybrid search: text + visual retrieval, merge, deduplicate, normalize, rerank.
   *
   * @param query User's text query
   * @param workspaceId User's workspace ID (for authorization)
   * @param textProvider Text embedding provider for query embedding
   * @param visualProvider Visual embedding provider for visual query (optional - can be undefined for text-only hybrid)
   * @param visualQueryImageFile Optional image file for visual search (if provided, visual retrieval runs)
   * @param filters Optional filters (evidence types, manufacturers, document IDs, min confidence, page)
   * @param rerankerOverride Optional reranker config override
   * @returns Hybrid search results with ranking signals and final scores
   */
  async search(
    query: string,
    workspaceId: number,
    textProvider: EmbeddingProvider,
    visualProvider?: VisualEmbeddingProvider,
    visualQueryImageFile?: File,
    filters?: {
      evidenceTypes?: string[];
      manufacturers?: string[];
      documentIds?: number[];
      minConfidence?: number;
      page?: number;
    },
    rerankerOverride?: RerankerConfig,
  ): Promise<{
    results: RerankedResult[];
    normalized: import("./normalization").NormalizedScores;
    queryIntent: QueryIntent | undefined;
    candidateCount: number;
    textCandidateCount: number;
    visualCandidateCount: number;
    latencyMs: number;
  }> {
    const startTime = Date.now();

    // --- Step 1: Detect query intent ---
    const intentResult = detectIntent(query);
    const queryIntent = intentResult.intent;

    // --- Step 2: Retrieve text candidates ---
    const textCandidates = await this.retrieveTextCandidates(
      query,
      workspaceId,
      textProvider,
      filters,
      this.config.textCandidateLimit!
    );

    // --- Step 3: Retrieve visual candidates (if visual input provided) ---
    let visualCandidates: HybridCandidate[] = [];
    if (visualQueryImageFile && visualProvider) {
      visualCandidates = await this.retrieveVisualCandidates(
        visualQueryImageFile,
        workspaceId,
        visualProvider,
        filters,
        this.config.visualCandidateLimit!
      );
    }

    // --- Step 4: Merge and deduplicate candidates ---
    const mergedCandidates = this.mergeCandidates(textCandidates, visualCandidates);

    // --- Step 5: Normalize scores across the candidate pool ---
    const { candidates: normalizedCandidates, normalized } = normalizeCandidatePool(
      mergedCandidates.map(c => ({
        evidence: c.evidence,
        textScore: c.textScore,
        visualScore: c.visualScore,
      }))
    );

    // --- Step 6: Execute deterministic reranking ---
    const rerankerConfig = rerankerOverride ?? this.config.reranker;
    const reranker = new DeterministicReranker(rerankerConfig);

    const rankedResults = reranker.rerank(
      normalizedCandidates,
      rerankerConfig,
      queryIntent
    );

    // --- Step 7: Apply result limit ---
    const finalResults = rankedResults.slice(0, this.config.resultLimit!);

    const latencyMs = Date.now() - startTime;

    // --- Record search history (lightweight, no sensitive data) ---
    try {
      await db.insert(searchHistory).values({
        workspaceId,
        query,
        mode: "hybrid",
        resultCount: finalResults.length,
        latencyMs,
      });
    } catch (e) {
      // History recording is best-effort; don't block results
    }

    return {
      results: finalResults,
      normalized,
      queryIntent,
      candidateCount: mergedCandidates.length,
      textCandidateCount: textCandidates.length,
      visualCandidateCount: visualCandidates.length,
      latencyMs,
    };
  }

  /**
   * Retrieve top N text candidates using pgvector semantic search.
   */
  private async retrieveTextCandidates(
    query: string,
    workspaceId: number,
    provider: EmbeddingProvider,
    filters?: any,
    candidateLimit: number
  ): Promise<HybridCandidate[]> {
    const retrieval = await retrieveSimilarEvidence(
      query,
      workspaceId,
      provider,
      { model: "nvidia/nemotron", dimension: 384, metric: "cosine" },
      filters,
      candidateLimit
    );

    return retrieval.results.map(r => ({
      evidence: r.evidence,
      textScore: r.similarity,
      evidenceType: r.evidence.evidenceType,
      manufacturer: r.evidence.manufacturer,
      mpn: r.evidence.mpn,
    }));
  }

  /**
   * Retrieve top N visual candidates using pgvector visual search.
   */
  private async retrieveVisualCandidates(
    imageFile: File,
    workspaceId: number,
    provider: VisualEmbeddingProvider,
    filters?: any,
    candidateLimit: number
  ): Promise<HybridCandidate[]> {
    // Preprocess and embed the query image
    const { buffer } = await this.preprocessImageForEmbedding(imageFile);

    const retrieval = await retrieveVisualSimilarEvidence(
      buffer as number[],
      workspaceId,
      provider,
      { model: "local-visual", dimension: 384, metric: "cosine" },
      filters,
      candidateLimit
    );

    return retrieval.results.map(r => ({
      evidence: r.evidence,
      visualScore: r.visualSimilarity,
      evidenceType: r.evidence.evidenceType,
      manufacturer: r.evidence.manufacturer,
      mpn: r.evidence.mpn,
    }));
  }

  /**
   * Merge text and visual candidate pools, deduplicating by evidence ID.
   * When the same evidence appears in both pools, both textScore and visualScore
   * are populated. When it appears in only one lane, only the relevant score is set.
   */
  private mergeCandidates(
    textCandidates: HybridCandidate[],
    visualCandidates: HybridCandidate[]
  ): HybridCandidate[] {
    // Build a map from evidence ID to merged candidate
    const candidateMap = new Map<number, HybridCandidate>();

    // Add text candidates
    for (const c of textCandidates) {
      const existing = candidateMap.get(c.evidence.id);
      if (existing) {
        // Merge: keep existing visualScore if present, add/update textScore
        existing.textScore = c.textScore;
        existing.evidenceType = c.evidenceType;
        existing.manufacturer = c.manufacturer;
        existing.mpn = c.mpn;
      } else {
        candidateMap.set(c.evidence.id, {
          ...c,
          visualScore: undefined,
        });
      }
    }

    // Add visual candidates
    for (const c of visualCandidates) {
      const existing = candidateMap.get(c.evidence.id);
      if (existing) {
        // Merge: keep existing textScore, add/update visualScore
        existing.visualScore = c.visualScore;
        existing.evidenceType = c.evidenceType;
        existing.manufacturer = c.manufacturer;
        existing.mpn = c.mpn;
      } else {
        candidateMap.set(c.evidence.id, {
          ...c,
          textScore: undefined,
        });
      }
    }

    return Array.from(candidateMap.values());
  }

  /**
   * Preprocess a query image file for embedding.
   * Reads the file as a buffer - the embedding provider handles internal preprocessing.
   */
  private async preprocessImageForEmbedding(imageFile: File): Promise<{ buffer: Buffer }> {
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return { buffer };
  }
}