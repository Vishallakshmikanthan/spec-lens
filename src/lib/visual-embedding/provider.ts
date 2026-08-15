/**
 * VisualEmbeddingProvider abstraction.
 *
 * Defines the interface for visual (image) embedding models.
 * Implementations can be:
 * - Nemotron-compatible vision provider (via OpenAI-compatible API)
 * - Local vision model (e.g., CLIP, other open-source models)
 * - Hosted provider (e.g., Google Vision, AWS Rekognition)
 *
 * The architecture must allow switching providers without
 * rewriting retrieval logic.
 *
 * ALL implementation details (API keys, endpoints, auth headers)
 * MUST remain server-side. Never expose secrets to the browser.
 */
export type VisualEmbeddingDimension = 384 | 768 | 1024 | 1536 | 3072 | 4096;

export interface EmbeddingConfig {
  /** Model identifier (e.g., "nvidia/nemotron", "all-MiniLM-L6-v2") */
  model: string;
  /** Embedding dimension must match the pgvector column dimension */
  dimension: VisualEmbeddingDimension;
  /** Similarity metric: cosine, l2, or ip (inner product) */
  metric: "cosine" | "l2" | "ip";
  /** Optional API base URL for hosted providers */
  apiBase?: string;
  /** Optional timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Embed a single image buffer/FILE into a vector.
 */
export interface VisualEmbeddingProvider {
  /** Embed a single image buffer/FILE into a vector. */
  embedImage(image: Buffer | File): Promise<number[]>;
  /** Embed multiple images in one request if the provider supports batching. */
  embedImages(images: Buffer | File[]): Promise<number[][]>;
}

/**
 * Lightweight metadata about a visual embedding, used for content-hash dedup
 * and model version tracking.
 */
export interface VisualEmbeddingMetadata {
  model: string;
  version: string;
  dimension: VisualEmbeddingDimension;
  metric: "cosine" | "l2" | "ip";
  contentHash: string; // SHA-256 of the image buffer that was embedded
}