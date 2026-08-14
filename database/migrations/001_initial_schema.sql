-- ============================================================
-- Migration 001: Create users table
-- ============================================================
CREATE TABLE IF NOT EXISTS "users" (
  id SERIAL PRIMARY KEY,
  name VARCHAR(256),
  email VARCHAR(256) UNIQUE,
  password_hash VARCHAR(256),
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Migration 002: Create workspaces table
-- ============================================================
CREATE TABLE IF NOT EXISTS "workspaces" (
  id SERIAL PRIMARY KEY,
  name VARCHAR(256),
  plan VARCHAR(50) DEFAULT 'free',
  created_by INTEGER REFERENCES "users"(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Migration 003: Create workspace_members table
-- ============================================================
CREATE TABLE IF NOT EXISTS "workspace_members" (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES "workspaces"(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES "users"(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (workspace_id, user_id)
);

-- ============================================================
-- Migration 004: Create datasheets table
-- ============================================================
CREATE TABLE IF NOT EXISTS "datasheets" (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES "workspaces"(id) ON DELETE CASCADE,
  mpn VARCHAR(100),
  manufacturer VARCHAR(256),
  title VARCHAR(512),
  file_name VARCHAR(512),
  storage_key VARCHAR(512),
  mime_type VARCHAR(100),
  file_size DOUBLE PRECISION,
  page_count INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  index_status VARCHAR(50) DEFAULT 'queued',
  favorite BOOLEAN DEFAULT FALSE,
  created_by INTEGER REFERENCES "users"(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Migration 005: Create components table
-- ============================================================
CREATE TABLE IF NOT EXISTS "components" (
  id SERIAL PRIMARY KEY,
  mpn VARCHAR(100) NOT NULL,
  manufacturer VARCHAR(256) NOT NULL,
  family VARCHAR(256),
  description TEXT,
  packages TEXT,
  specifications TEXT,
  verified_specifications TEXT,
  history TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Migration 006: Create component_relationships table
-- ============================================================
CREATE TABLE IF NOT EXISTS "component_relationships" (
  id SERIAL PRIMARY KEY,
  source_component_id INTEGER REFERENCES "components"(id) ON DELETE CASCADE,
  target_component_id INTEGER REFERENCES "components"(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (source_component_id, target_component_id, relationship_type)
);

-- ============================================================
-- Migration 007: Create collections table
-- ============================================================
CREATE TABLE IF NOT EXISTS "collections" (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES "workspaces"(id) ON DELETE CASCADE,
  name VARCHAR(256),
  description TEXT,
  created_by INTEGER REFERENCES "users"(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Migration 008: Create collection_items table
-- ============================================================
CREATE TABLE IF NOT EXISTS "collection_items" (
  id SERIAL PRIMARY KEY,
  collection_id INTEGER REFERENCES "collections"(id) ON DELETE CASCADE,
  item_type VARCHAR(20) NOT NULL, -- 'datasheet' | 'evidence' | 'component'
  item_id INTEGER NOT NULL,
  UNIQUE (collection_id, item_type, item_id)
);

-- ============================================================
-- Migration 009: Create datasheet_pages table
-- ============================================================
CREATE TABLE IF NOT EXISTS "datasheet_pages" (
  id SERIAL PRIMARY KEY,
  datasheet_id INTEGER REFERENCES "datasheets"(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  width DOUBLE PRECISION,
  height DOUBLE PRECISION,
  storage_key VARCHAR(512),
  text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Migration 010: Create evidence table
-- ============================================================
CREATE TABLE IF NOT EXISTS "evidence" (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES "workspaces"(id) ON DELETE CASCADE,
  datasheet_id INTEGER REFERENCES "datasheets"(id) ON DELETE CASCADE,
  page_id INTEGER REFERENCES "datasheet_pages"(id) ON DELETE SET NULL,
  component_id INTEGER REFERENCES "components"(id) ON DELETE SET NULL,
  mpn VARCHAR(100),
  manufacturer VARCHAR(256),
  title VARCHAR(512),
  evidence_type VARCHAR(50),
  page_number INTEGER,
  bbox_x DOUBLE PRECISION NOT NULL,
  bbox_y DOUBLE PRECISION NOT NULL,
  bbox_width DOUBLE PRECISION NOT NULL,
  bbox_height DOUBLE PRECISION NOT NULL,
  confidence DOUBLE PRECISION DEFAULT 1,
  verification_state VARCHAR(50),
  caption TEXT,
  crop_storage_key VARCHAR(512),
  retrieval_score DOUBLE PRECISION,
  model_version VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Migration 011: Create processing_jobs table
-- ============================================================
CREATE TABLE IF NOT EXISTS "processing_jobs" (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES "workspaces"(id) ON DELETE CASCADE,
  file_name VARCHAR(512),
  storage_key VARCHAR(512),
  mime_type VARCHAR(100),
  file_size DOUBLE PRECISION,
  mpn VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'queued', -- queued|processing|completed|failed|cancelled
  progress DOUBLE PRECISION DEFAULT 0,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error TEXT,
  duration DOUBLE PRECISION,
  pages INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Migration 012: Create processing_stages table
-- ============================================================
CREATE TABLE IF NOT EXISTS "processing_stages" (
  id SERIAL PRIMARY KEY,
  processing_job_id INTEGER REFERENCES "processing_jobs"(id) ON DELETE CASCADE,
  stage VARCHAR(50) NOT NULL, -- ingest|render|layout|regions|embed|index|verify
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending|in_progress|completed|failed
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error TEXT,
  UNIQUE (processing_job_id, stage)
);

-- ============================================================
-- Migration 013: Create search_history table
-- ============================================================
CREATE TABLE IF NOT EXISTS "search_history" (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES "workspaces"(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES "users"(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  filters TEXT, -- JSON stored as text
  result_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Migration 014: Create activity_events table
-- ============================================================
CREATE TABLE IF NOT EXISTS "activity_events" (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES "users"(id) ON DELETE SET NULL,
  workspace_id INTEGER REFERENCES "workspaces"(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- e.g., "index", "detect", "query", "verify", "error"
  entity_type VARCHAR(50), -- e.g., "datasheet", "evidence", "component", "collection"
  entity_id INTEGER,
  metadata TEXT, -- JSON stored as text
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Migration 015: Create notifications table
-- ============================================================
CREATE TABLE IF NOT EXISTS "notifications" (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES "users"(id) ON DELETE CASCADE,
  workspace_id INTEGER REFERENCES "workspaces"(id) ON DELETE CASCADE,
  title VARCHAR(256) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- e.g., "success", "info", "error"
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Migration 016: Create copilot_conversations table
-- ============================================================
CREATE TABLE IF NOT EXISTS "copilot_conversations" (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES "workspaces"(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES "users"(id) ON DELETE CASCADE,
  title VARCHAR(256),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Migration 017: Create copilot_messages table
-- ============================================================
CREATE TABLE IF NOT EXISTS "copilot_messages" (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES "copilot_conversations"(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, -- 'user' | 'assistant'
  content TEXT NOT NULL,
  sources TEXT, -- JSON stored as text, links to evidence/component IDs
  confidence DOUBLE PRECISION,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Migration 018: Create symbols table
-- ============================================================
CREATE TABLE IF NOT EXISTS "symbols" (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES "workspaces"(id) ON DELETE CASCADE,
  component_id INTEGER REFERENCES "components"(id) ON DELETE SET NULL,
  package VARCHAR(256),
  stage VARCHAR(50),
  validation_state VARCHAR(50),
  generated_source TEXT,
  generated_metadata TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Migration 019: Create symbol_pins table
-- ============================================================
CREATE TABLE IF NOT EXISTS "symbol_pins" (
  id SERIAL PRIMARY KEY,
  symbol_id INTEGER REFERENCES "symbols"(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  name VARCHAR(100),
  type VARCHAR(50),
  position TEXT, -- JSON text for position coordinates
  electrical_type VARCHAR(50),
  evidence_id INTEGER REFERENCES "evidence"(id) ON DELETE SET NULL
);

-- ============================================================
-- Migration 020: Create document_embeddings table (pgvector)
-- ============================================================
CREATE TABLE IF NOT EXISTS "document_embeddings" (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES "workspaces"(id) ON DELETE CASCADE,
  datasheet_id INTEGER REFERENCES "datasheets"(id) ON DELETE CASCADE,
  embedding TEXT, -- Stores pgvector data as JSON/string; pgvector extension required
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Migration 021: Create evidence_embeddings table (pgvector)
-- ============================================================
CREATE TABLE IF NOT EXISTS "evidence_embeddings" (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES "workspaces"(id) ON DELETE CASCADE,
  evidence_id INTEGER REFERENCES "evidence"(id) ON DELETE CASCADE,
  embedding TEXT, -- Stores pgvector data as JSON/string; pgvector extension required
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Indexes for workspace isolation and query performance
-- ============================================================

-- Indexes on users
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users"(email);

-- Indexes on workspaces
CREATE INDEX IF NOT EXISTS "idx_workspaces_created_by" ON "workspaces"(created_by);

-- Indexes on workspace_members
CREATE INDEX IF NOT EXISTS "idx_workspace_members_workspace" ON "workspace_members"(workspace_id);
CREATE INDEX IF NOT EXISTS "idx_workspace_members_user" ON "workspace_members"(user_id);

-- Indexes on datasheets
CREATE INDEX IF NOT EXISTS "idx_datasheets_workspace" ON "datasheets"(workspace_id);
CREATE INDEX IF NOT EXISTS "idx_datasheets_mpn" ON "datasheets"(mpn);

-- Indexes on components
CREATE INDEX IF NOT EXISTS "idx_components_mpn" ON "components"(mpn);

-- Indexes on component_relationships
CREATE INDEX IF NOT EXISTS "idx_component_rels_source" ON "component_relationships"(source_component_id);
CREATE INDEX IF NOT EXISTS "idx_component_rels_target" ON "component_relationships"(target_component_id);

-- Indexes on collections
CREATE INDEX IF NOT EXISTS "idx_collections_workspace" ON "collections"(workspace_id);

-- Indexes on collection_items
CREATE INDEX IF NOT EXISTS "idx_collection_items_collection" ON "collection_items"(collection_id);

-- Indexes on datasheet_pages
CREATE INDEX IF NOT EXISTS "idx_pages_datasheet" ON "datasheet_pages"(datasheet_id);
CREATE INDEX IF NOT EXISTS "idx_pages_number" ON "datasheet_pages"(datasheet_id, page_number);

-- Indexes on evidence
CREATE INDEX IF NOT EXISTS "idx_evidence_workspace" ON "evidence"(workspace_id);
CREATE INDEX IF NOT EXISTS "idx_evidence_datasheet" ON "evidence"(datasheet_id);
CREATE INDEX IF NOT EXISTS "idx_evidence_component" ON "evidence"(component_id);

-- Indexes on processing_jobs
CREATE INDEX IF NOT EXISTS "idx_jobs_workspace" ON "processing_jobs"(workspace_id);
CREATE INDEX IF NOT EXISTS "idx_jobs_status" ON "processing_jobs"(status);

-- Indexes on processing_stages
CREATE INDEX IF NOT EXISTS "idx_stages_job" ON "processing_stages"(processing_job_id);

-- Indexes on search_history
CREATE INDEX IF NOT EXISTS "idx_search_history_workspace" ON "search_history"(workspace_id);
CREATE INDEX IF NOT EXISTS "idx_search_history_user" ON "search_history"(user_id);

-- Indexes on activity_events
CREATE INDEX IF NOT EXISTS "idx_activity_workspace" ON "activity_events"(workspace_id);
CREATE INDEX IF NOT EXISTS "idx_activity_event_type" ON "activity_events"(event_type);

-- Indexes on notifications
CREATE INDEX IF NOT EXISTS "idx_notifications_user" ON "notifications"(user_id);
CREATE INDEX IF NOT EXISTS "idx_notifications_workspace" ON "notifications"(workspace_id);
CREATE INDEX IF NOT EXISTS "idx_notifications_read" ON "notifications"(read);

-- Indexes on copilot_conversations
CREATE INDEX IF NOT EXISTS "idx_conv_workspace" ON "copilot_conversations"(workspace_id);
CREATE INDEX IF NOT EXISTS "idx_conv_user" ON "copilot_conversations"(user_id);

-- Indexes on copilot_messages
CREATE INDEX IF NOT EXISTS "idx_messages_conv" ON "copilot_messages"(conversation_id);

-- Indexes on symbols
CREATE INDEX IF NOT EXISTS "idx_symbols_workspace" ON "symbols"(workspace_id);
CREATE INDEX IF NOT EXISTS "idx_symbols_component" ON "symbols"(component_id);

-- Indexes on symbol_pins
CREATE INDEX IF NOT EXISTS "idx_pins_symbol" ON "symbol_pins"(symbol_id);
CREATE INDEX IF NOT EXISTS "idx_pins_evidence" ON "symbol_pins"(evidence_id);

-- Indexes on document_embeddings
CREATE INDEX IF NOT EXISTS "idx_doc_emb_workspace" ON "document_embeddings"(workspace_id);
CREATE INDEX IF NOT EXISTS "idx_doc_emb_datasheet" ON "document_embeddings"(datasheet_id);

-- Indexes on evidence_embeddings
CREATE INDEX IF NOT EXISTS "idx_evidence_emb_workspace" ON "evidence_embeddings"(workspace_id);
CREATE INDEX IF NOT EXISTS "idx_evidence_emb_evidence" ON "evidence_embeddings"(evidence_id);