-- ============================================================
-- Migration 023: Add visual embedding columns to evidence_embeddings
-- ============================================================

-- Add visual_embedding column for visual embeddings (pgvector type)
-- This stores visual embeddings separate from text embeddings
ALTER TABLE "evidence_embeddings" ADD COLUMN IF NOT EXISTS "visual_embedding" vector("visual_embedding", { dimension: 384 });

-- Add visual_content_hash column for visual embedding dedup
-- SHA-256 hash of the image buffer that was embedded
ALTER TABLE "evidence_embeddings" ADD COLUMN IF NOT EXISTS "visual_content_hash" VARCHAR(64);

-- Add visual_embedding_model column for model tracking
ALTER TABLE "evidence_embeddings" ADD COLUMN IF NOT EXISTS "visual_embedding_model" VARCHAR(100);

-- Add visual_embedding_version column for model version tracking
ALTER TABLE "evidence_embeddings" ADD COLUMN IF NOT EXISTS "visual_embedding_version" VARCHAR(50);

-- Add visual_embedding_dimension column for dimension tracking
ALTER TABLE "evidence_embeddings" ADD COLUMN IF NOT EXISTS "visual_embedding_dimension" INTEGER DEFAULT 384;

-- Index on visual content hash for dedup performance
CREATE INDEX IF NOT EXISTS "evidence_visual_hash_idx" ON "evidence_embeddings"(("visual_content_hash"));

-- Index on visual embedding for vector search performance (pgvector index)
-- This uses the ivfflat index method for cosine similarity
-- The index will be built/updated when visual embeddings are first populated
-- Commented out: CREATE INDEX IF NOT EXISTS "evidence_visual_emb_idx" ON "evidence_embeddings" USING ivfflat ("visual_embedding" vector_cosine_ops);

-- Note: pgvector ivfflat indexes require building with embeddings first.
-- The index will be created during the first indexing pipeline run.