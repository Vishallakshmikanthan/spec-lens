/**
 * EmbeddingProvider abstraction.
 *
 * Defines the interface for text embedding models.
 * Implementations can be:
 * - Nemotron-compatible local provider (via OpenAI-compatible API)
 * - Local embedding model (e.g., sentence-transformers)
 * - Hosted provider (e.g., OpenAI, Cohere, Anthropic)
 *
 * The architecture must allow switching providers without
 * rewriting retrieval logic.
 *
 * ALL implementation details (API keys, endpoints, auth headers)
 * MUST remain server-side. Never expose secrets to the browser.
 */
export type EmbeddingDimension = 384 | 768 | 1024 | 1536 | 3072 | 4096;

export interface EmbeddingConfig {
  /** Model identifier (e.g., "nvidia/nemotron", "all-MiniLM-L6-v2") */
  model: string;
  /** Embedding dimension must match the pgvector column dimension */
  dimension: EmbeddingDimension;
  /** Similarity metric: cosine, l2, or ip (inner product) */
  metric: "cosine" | "l2" | "ip";
  /** Optional API base URL for hosted providers */
  apiBase?: string;
  /** Optional timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Embed a single text string.
 * Returns a vector of numbers (the embedding).
 */
export interface EmbeddingProvider {
  embedText(text: string): Promise<number[]>;
  /** Embed multiple texts in one request if the provider supports batching. */
  embedTexts(texts: string[]): Promise<number[][]>;
}

/**
 * Lightweight metadata about an embedding, used for content-hash dedup
 * and model version tracking.
 */
export interface EmbeddingMetadata {
  model: string;
  version: string;
  dimension: EmbeddingDimension;
  metric: "cosine" | "l2" | "ip";
  contentHash: string; // SHA-256 of the input text that was embedded
}