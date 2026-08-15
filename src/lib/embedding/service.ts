/**
 * EmbeddingService.
 *
 * Orchestrates the embedding pipeline:
 * 1. Construct searchable text from Evidence records
 * 2. Compute content hash for dedup
 * 3. Check for existing identical embeddings
 * 4. Generate embeddings (with batching, retry)
 * 5. Persist vectors to pgvector
 * 6. Record model metadata
 *
 * Design goals:
 * - Provider-agnostic: uses EmbeddingProvider abstraction
 * - Batching: supports batch embedding calls
 * - Dedup: content-hash based duplicate prevention
 * - Retry: exponential backoff for transient failures only
 * - Server-side only: no API keys exposed to browser
 */
import { EmbeddingProvider, EmbeddingConfig, EmbeddingMetadata, EmbeddingDimension } from "./provider";
import { evidenceEmbeddings, documentEmbeddings, workspaces, datasheets } from "@/database/schema";
import { db } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
// Use Node.js crypto for content hashing (server-side)
async function importCrypto() {
  const crypto = await import("crypto");
  return crypto.createHash("sha256");
}

const sha256 = async (text: string) => {
  const hash = await importCrypto()(text).digest("hex");
  return hash;
};


const DEFAULT_CONFIG: EmbeddingConfig = {
  model: "nvidia/nemotron",
  dimension: 384,
  metric: "cosine",
  timeoutMs: 30000,
};

const DEFAULT_BATCH_SIZE = 32;
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 500;

/**
 * Construct a searchable embedding text from an Evidence record.
 * Contains the most relevant fields for semantic matching.
 */
export function constructEmbeddingText(evidence: {
  id: number;
  title: string | null;
  caption: string | null;
  evidenceType: string | null;
  manufacturer: string | null;
  mpn: string | null;
  pageNumber: number | null;
  heading: string | null;
  extractedText: string | null;
}): string {
  const parts: string[] = [];

  if (evidence.mpn) parts.push(`MPN: ${evidence.mpn}`);
  if (evidence.manufacturer) parts.push(`Manufacturer: ${evidence.manufacturer}`);
  if (evidence.evidenceType) parts.push(`Type: ${evidence.evidenceType}`);
  if (evidence.title) parts.push(`Title: ${evidence.title}`);
  if (evidence.caption) parts.push(`Caption: ${evidence.caption}`);
  if (evidence.heading) parts.push(`Heading: ${evidence.heading}`);
  if (evidence.pageNumber !== null && evidence.pageNumber !== undefined) parts.push(`Page: ${evidence.pageNumber}`);
  if (evidence.extractedText) parts.push(`Text: ${evidence.extractedText}`);

  return parts.join(' | ');
}

/**
 * Compute a SHA-256 content hash for dedup.
 * Same input text -> same hash -> skip re-embedding.
 */
export async function computeContentHash(text: string): Promise<string> {
  const buf = await Promise.resolve().then(() => import('crypto'));
  const hash = buf.createHash('sha256').update(text).digest('hex');
  return hash;
}

/**
 * Check if an embedding already exists for the given evidence and content hash.
 * Returns the existing embedding record if found, otherwise null.
 */
async function findExistingEmbedding(
  evidenceId: number,
  contentHash: string,
  workspaceId: number
) {
  const existing = await db.query.evidenceEmbeddings.findFirst({
    where: eq(evidenceEmbeddings.evidenceId, evidenceId),
    columns: {
      contentHash: true,
      embedding: true,
      embeddingModel: true,
      embeddingVersion: true,
    },
  });

  if (existing && existing.contentHash === contentHash) {
    return existing;
  }
  return null;
}

/**
 * Generate embeddings for a list of texts using the provider.
 * Implements exponential backoff retry for transient failures only.
 */
async function generateEmbeddings(
  provider: EmbeddingProvider,
  texts: string[],
  config: EmbeddingConfig
): Promise<number[][]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (texts.length === 1) {
        return [await provider.embedText(texts[0])];
      } else {
        return await provider.embedTexts(texts);
      }
    } catch (error: any) {
      lastError = error;

      // Do NOT retry authentication errors, permission errors, or 4xx errors
      const status = error.status ?? error.statusCode;
      if (status && status >= 400 && status < 500) {
        throw error; // Client error, don't retry
      }

      // Last attempt - re-throw
      if (attempt >= MAX_RETRIES) {
        break;
      }

      // Exponential backoff
      const backoffMs = BACKOFF_BASE_MS * 2 ** attempt;
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }

  throw lastError || new Error('Embedding generation failed after max retries');
}

/**
 * Main pipeline: embed evidence records.
 * For each evidence item:
 *  1. Construct embedding text
 *  2. Compute content hash
 *  3. Check if identical embedding already exists
 *  4. Generate embedding if new
 *  5. Store vector and metadata
 *  6. Update processing job stage
 */
export async function embedEvidence(
  evidence: {
    id: number;
    title: string | null;
    caption: string | null;
    evidenceType: string | null;
    manufacturer: string | null;
    mpn: string | null;
    pageNumber: number | null;
    heading: string | null;
    extractedText: string | null;
  },
  workspaceId: number,
  provider: EmbeddingProvider,
  config: EmbeddingConfig = DEFAULT_CONFIG
) {
  // Step 1: Construct embedding text
  const embeddingText = constructEmbeddingText(evidence);

  // Step 2: Compute content hash
  const contentHash = await computeContentHash(embeddingText);

  // Step 3: Check for existing identical embedding
  const existing = await findExistingEmbedding(evidence.id, contentHash, workspaceId);
  if (existing) {
    // Already embedded with same content - nothing to do
    return { status: 'skipped', reason: 'duplicate', existingEmbeddingId: existing.id };
  }

  // Step 4: Generate embedding
  const vectors = await generateEmbeddings(provider, [embeddingText], config);

  const embedding = vectors[0];

  // Step 5: Store vector and metadata
  await db.insert(evidenceEmbeddings).values({
    workspaceId,
    evidenceId: evidence.id,
    embedding,
    contentHash,
    embeddingModel: config.model,
    embeddingVersion: config.model,
    embeddingDimension: config.dimension,
    metric: config.metric,
  });

  return {
    status: 'completed',
    embedding,
    contentHash,
    embeddingId: null,
  };
}

/**
 * Batch embed multiple evidence items.
 * Groups texts and processes in controlled batches to avoid rate-limit explosions.
 */
export async function batchEmbedEvidence(
  evidences: Array<{
    id: number;
    title: string | null;
    caption: string | null;
    evidenceType: string | null;
    manufacturer: string | null;
    mpn: string | null;
    pageNumber: number | null;
    heading: string | null;
    extractedText: string | null;
  }>,
  workspaceId: number,
  provider: EmbeddingProvider,
  config: EmbeddingConfig = DEFAULT_CONFIG,
  batchSize: number = DEFAULT_BATCH_SIZE
) {
  const results: Array<{
    evidenceId: number;
    status: 'completed' | 'skipped' | 'failed';
    embeddingId?: number;
    error?: Error;
  }> = [];

  // Process in batches
  for (let i = 0; i < evidences.length; i += batchSize) {
    const batch = evidences.slice(i, i + batchSize);

    // Construct all embedding texts for this batch
    const texts = batch.map(evidence => constructEmbeddingText(evidence));

    // Compute all content hashes
    const contentHashes = await Promise.all(texts.map(t => computeContentHash(t)));

    // Check which ones already exist
    const existenceChecks = await Promise.all(
      batch.map((evidence, idx) =>
        findExistingEmbedding(evidence.id, contentHashes[idx], workspaceId)
      )
    );

    // Filter out duplicates
    const toEmbed = batch.filter((_evidence, idx) => !existenceChecks[idx]);

    if (toEmbed.length === 0) {
      // All duplicates
      results.push(...batch.map(() => ({ evidenceId: batch[0].id, status: 'skipped', reason: 'duplicate' })));
      continue;
    }

    // Construct texts for the ones to embed (only new ones)
    const newTexts = toEmbed.map(evidence => constructEmbeddingText(evidence));
    const newHashes = await Promise.all(newTexts.map(t => computeContentHash(t)));

    // Generate embeddings
    try {
      const vectors = await generateEmbeddings(provider, newTexts, config);

      // Store each embedding
      for (let i = 0; i < toEmbed.length; i++) {
        await db.insert(evidenceEmbeddings).values({
          workspaceId,
          evidenceId: toEmbed[i].id,
          embedding: vectors[i],
          contentHash: newHashes[i],
          embeddingModel: config.model,
          embeddingVersion: config.model,
          embeddingDimension: config.dimension,
          metric: config.metric,
        });

        results.push({
          evidenceId: toEmbed[i].id,
          status: 'completed',
        });
      }
    } catch (error: any) {
      // All batch items failed
      toEmbed.forEach(evidence => {
        results.push({
          evidenceId: evidence.id,
          status: 'failed',
          error: error,
        });
      });
    }
  }

  return results;
}