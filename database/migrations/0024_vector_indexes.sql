-- ============================================================
-- Migration 024: Add pgvector indexes for similarity search
-- ============================================================

-- --------------------------------------------------------
-- Document embeddings index
-- --------------------------------------------------------
-- ivfflat index for cosine similarity search on document embeddings.
-- 100 clusters is a reasonable starting point; adjust based on dataset size.
-- The index must be built (populated) after embeddings exist:
--   SELECT pg_create_ivfflat_index('document_embeddings', 'embedding', 100);
--
-- For L2 distance, use: 'vector_l2_ops'
-- For cosine similarity, use: 'vector_cosine_ops' (default)
-- For inner product, use: 'vector_ip_ops'
--
-- To create the index (run after data is populated):
--   SELECT create_ivfflat_index('document_embeddings', 'embedding', 100);
--
-- NOTE: pgvector version < 0.5.0 may use different syntax.
-- This migration assumes pgvector 0.1.0+ with migration-style index creation.
--

-- Create ivfflat index on document_embeddings.embedding for cosine similarity
-- using 100 lists (clusters). Adjust based on dataset size.
SELECT
    create_ivfflat_index('document_embeddings', 'embedding', 100);

-- --------------------------------------------------------
-- Evidence embeddings index
-- --------------------------------------------------------
-- ivfflat index for cosine similarity search on evidence embeddings.
-- Separate index from document embeddings since they may have
-- different content and search patterns.
--

Create evidence embeddings ivfflat index for cosine similarity
using 100 lists (clusters). Adjust based on dataset size.
SELECT
    create_ivfflat_index('evidence_embeddings', 'embedding', 100);

-- Optional: separate index for visual embeddings if visual search is enabled
-- SELECT
--     create_ivfflat_index('evidence_embeddings', 'visual_embedding', 100);
--
-- --------------------------------------------------------
-- Index on content hash for dedup performance
-- --------------------------------------------------------
-- Document embeddings content hash index
CREATE INDEX IF NOT EXISTS "doc_emb_hash_idx" ON "document_embeddings"("content_hash");

-- Evidence embeddings content hash index
CREATE INDEX IF NOT EXISTS "evidence_emb_hash_idx" ON "evidence_embeddings"("content_hash");

-- --------------------------------------------------------
-- Summary
-- --------------------------------------------------------
-- Index types chosen:
-- - ivfflat: Inverted File index, good for cosine similarity on medium/large datasets
--   - Query: O(n/list) to scan ~1/list of dataset
--   - Build time: O(n log n) to build clusters
--   - Requires: embeddings must exist before index creation
-- - Supports: cosine, l2, ip distance metrics
-- - Default operator: vector_cosine_ops for cosine similarity
--
-- For very large datasets (10K+ vectors), consider HNSW:
--   CREATE INDEX ... USING hnsw (embedding vector_cosine_ops);
--
-- For small datasets (< 1K vectors), a sequential scan may be faster
-- than index lookup overhead.