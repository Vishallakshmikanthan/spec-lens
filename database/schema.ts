import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  doublePrecision,
  index,
  primaryKey,
  vector,
} from "drizzle-orm"

// pgvector extension
import { type Vector } from "pgvector"

// ============================================================
// Core: Users
// ============================================================
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }),
  email: varchar("email", { length: 256 }).unique(),
  passwordHash: varchar("password_hash", { length: 256 }),
  role: varchar("role", { length: 50 }).default("member"),
  lastLoginAt: timestamp("last_login_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
})

export const usersTable = users

// ============================================================
// Core: Workspaces
// ============================================================
export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }),
  plan: varchar("plan", { length: 50 }).default("free"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
})

export const workspacesTable = workspaces

// ============================================================
// Core: Workspace Members (many-to-many)
// ============================================================
export const workspaceMembers = pgTable("workspace_members", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).default("member"),
  joinedAt: timestamp("joined_at", { mode: "string" }).defaultNow(),
}, (t) => ({
  uniqueWorkspaceUser: primaryKey({ columns: [t.workspaceId, t.userId] }),
}))

// ============================================================
// Server-side Sessions (HTTP-only cookie based)
// ============================================================
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 256 }).notNull,
  expiresAt: timestamp("expires_at", { mode: "string" }).notNull,
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  lastUsedAt: timestamp("last_used_at", { mode: "string" }).defaultNow(),
}, (t) => ({
  uniqueUserToken: primaryKey({ columns: [t.userId, t.tokenHash] }),
}))

// ============================================================
// Datasheet Model
// ============================================================
export const datasheets = pgTable("datasheets", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  mpn: varchar("mpn", { length: 100 }),
  manufacturer: varchar("manufacturer", { length: 256 }),
  title: varchar("title", { length: 512 }),
  fileName: varchar("file_name", { length: 512 }),
  storageKey: varchar("storage_key", { length: 512 }),
  mimeType: varchar("mime_type", { length: 100 }),
  fileSize: doublePrecision("file_size"),
  pageCount: integer("page_count").default(0),
  status: varchar("status", { length: 50 }).default("pending"),
  indexStatus: varchar("index_status", { length: 50 }).default("queued"),
  favorite: boolean("favorite").default(false),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
}, (t) => ({
  idxDatasheetsWorkspace: index("datasheets_workspace_idx").on(t.workspaceId),
}))

// ============================================================
// Page Model
// ============================================================
export const datasheetPages = pgTable("datasheet_pages", {
  id: serial("id").primaryKey(),
  datasheetId: integer("datasheet_id").references(() => datasheets.id, { onDelete: "cascade" }),
  pageNumber: integer("page_number").notNull(),
  width: doublePrecision("width"),
  height: doublePrecision("height"),
  storageKey: varchar("storage_key", { length: 512 }),
  text: text("text"),
  renderStatus: varchar("render_status", { length: 50 }).default("pending"),
  renderFormat: varchar("render_format", { length: 10 }).default("webp"),
  renderedAt: timestamp("rendered_at", { mode: "string" }),
  renderWidth: doublePrecision("render_width"),
  renderHeight: doublePrecision("render_height"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (t) => ({
  idxPagesDatasheet: index("pages_datasheet_idx").on(t.datasheetId),
  idxPagesNumber: index("pages_number_idx").on(t.datasheetId, t.pageNumber),
}))

// ============================================================
// Evidence Model (one of the most important entities)
// ============================================================
export const evidence = pgTable("evidence", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  datasheetId: integer("datasheet_id").references(() => datasheets.id, { onDelete: "cascade" }),
  pageId: integer("page_id").references(() => datasheetPages.id, { onDelete: "set null" }),
  componentId: integer("component_id").references(() => components.id, { onDelete: "set null" }),
  mpn: varchar("mpn", { length: 100 }),
  manufacturer: varchar("manufacturer", { length: 256 }),
  title: varchar("title", { length: 512 }),
  evidenceType: varchar("evidence_type", { length: 50 }),
  pageNumber: integer("page_number"),
  bboxX: doublePrecision("bbox_x").notNull(),
  bboxY: doublePrecision("bbox_y").notNull(),
  bboxWidth: doublePrecision("bbox_width").notNull(),
  bboxHeight: doublePrecision("bbox_height").notNull(),
  confidence: doublePrecision("confidence").default(1),
  verificationState: varchar("verification_state", { length: 50 }),
  caption: text("caption"),
  cropStorageKey: varchar("crop_storage_key", { length: 512 }),
  retrievalScore: doublePrecision("retrieval_score"),
  modelVersion: varchar("model_version", { length: 100 }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
}, (t) => ({
  idxEvidenceWorkspace: index("evidence_workspace_idx").on(t.workspaceId),
  idxEvidenceDatasheet: index("evidence_datasheet_idx").on(t.datasheetId),
  idxEvidenceComponent: index("evidence_component_idx").on(t.componentId),
}))

// ============================================================
// Component Model
// ============================================================
export const components = pgTable("components", {
  id: serial("id").primaryKey(),
  mpn: varchar("mpn", { length: 100 }).notNull(),
  manufacturer: varchar("manufacturer", { length: 256 }).notNull(),
  family: varchar("family", { length: 256 }),
  description: text("description"),
  packages: text("packages"), // JSON-friendly text for package info
  specifications: text("specifications"), // JSON-friendly text for flexible specs
  verifiedSpecifications: text("verified_specifications"), // JSON-friendly text
  history: text("history"), // JSON-friendly text for change history
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
}, (t) => ({
  idxComponentsMpn: index("components_mpn_idx").on(t.mpn),
}))

// ============================================================
// Component Relationships (self-referential)
// ============================================================
export const componentRelationships = pgTable("component_relationships", {
  id: serial("id").primaryKey(),
  sourceComponentId: integer("source_component_id").references(() => components.id, { onDelete: "cascade" }),
  targetComponentId: integer("target_component_id").references(() => components.id, { onDelete: "cascade" }),
  relationshipType: varchar("relationship_type", { length: 50 }), // e.g., "similar", "alternative", "subcomponent"
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (t) => ({
  uniqueRelationship: primaryKey({
    columns: [t.sourceComponentId, t.targetComponentId, t.relationshipType],
  }),
}))

// ============================================================
// Collections
// ============================================================
export const collections = pgTable("collections", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 256 }),
  description: text("description"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
}, (t) => ({
  idxCollectionsWorkspace: index("collections_workspace_idx").on(t.workspaceId),
}))

// Join table: collection items can be datasheets, evidence, or components
export const collectionItems = pgTable("collection_items", {
  id: serial("id").primaryKey(),
  collectionId: integer("collection_id").references(() => collections.id, { onDelete: "cascade" }),
  itemType: varchar("item_type", { length: 20 }).notNull(), // 'datasheet' | 'evidence' | 'component'
  itemId: integer("item_id").notNull(),
}, (t) => ({
  uniqueCollectionItem: primaryKey({ columns: [t.collectionId, t.itemType, t.itemId] }),
}))

// ============================================================
// Processing Jobs
// ============================================================
export const processingJobs = pgTable("processing_jobs", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 512 }),
  storageKey: varchar("storage_key", { length: 512 }),
  mimeType: varchar("mime_type", { length: 100 }),
  fileSize: doublePrecision("file_size"),
  mpn: varchar("mpn", { length: 100 }),
  status: varchar("status", { length: 50 }).notNull().default("queued"), // queued|processing|completed|failed|cancelled
  progress: doublePrecision("progress").default(0),
  startedAt: timestamp("started_at", { mode: "string" }),
  completedAt: timestamp("completed_at", { mode: "string" }),
  error: text("error"),
  duration: doublePrecision("duration"),
  pages: integer("pages").default(0),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
}, (t) => ({
  idxJobsWorkspace: index("jobs_workspace_idx").on(t.workspaceId),
}))

// Canonical processing stages table
export const processingStages = pgTable("processing_stages", {
  id: serial("id").primaryKey(),
  processingJobId: integer("processing_job_id").references(() => processingJobs.id, { onDelete: "cascade" }),
  stage: varchar("stage", { length: 50 }).notNull(), // ingest|render|layout|regions|embed|index|verify
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending|in_progress|completed|failed
  startedAt: timestamp("started_at", { mode: "string" }),
  completedAt: timestamp("completed_at", { mode: "string" }),
  error: text("error"),
}, (t) => ({
  uniqueJobStage: primaryKey({ columns: [t.processingJobId, t.stage] }),
  idxStagesJob: index("stages_job_idx").on(t.processingJobId),
}))

// ============================================================
// Search History
// ============================================================
export const searchHistory = pgTable("search_history", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  query: text("query").notNull(),
  filters: text("filters"), // JSON stored as text
  resultCount: integer("result_count").default(0),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (t) => ({
  idxSearchWorkspace: index("search_history_workspace_idx").on(t.workspaceId),
}))

// ============================================================
// Activity Events
// ============================================================
export const activityEvents = pgTable("activity_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 50 }).notNull(), // e.g., "index", "detect", "query", "verify", "error"
  entityType: varchar("entity_type", { length: 50 }), // e.g., "datasheet", "evidence", "component", "collection"
  entityId: integer("entity_id"),
  metadata: text("metadata"), // JSON stored as text
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (t) => ({
  idxActivityWorkspace: index("activity_workspace_idx").on(t.workspaceId),
}))

// ============================================================
// Notifications
// ============================================================
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 256 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // e.g., "success", "info", "error"
  read: boolean("read").default(false),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (t) => ({
  idxNotificationsUser: index("notifications_user_idx").on(t.userId),
}))

// ============================================================
// Copilot Conversations
// ============================================================
export const copilotConversations = pgTable("copilot_conversations", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 256 }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
}, (t) => ({
  idxConvWorkspace: index("conv_workspace_idx").on(t.workspaceId),
}))

// ============================================================
// Copilot Messages
// ============================================================
export const copilotMessages = pgTable("copilot_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => copilotConversations.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  sources: text("sources"), // JSON stored as text, links to evidence/component IDs
  confidence: doublePrecision("confidence"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (t) => ({
  idxMessagesConv: index("messages_conv_idx").on(t.conversationId),
}))

// ============================================================
// Symbols
// ============================================================
export const symbols = pgTable("symbols", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  componentId: integer("component_id").references(() => components.id, { onDelete: "set null" }),
  package: varchar("package", { length: 256 }),
  stage: varchar("stage", { length: 50 }),
  validationState: varchar("validation_state", { length: 50 }),
  generatedSource: text("generated_source"),
  generatedMetadata: text("generated_metadata"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
}, (t) => ({
  idxSymbolsWorkspace: index("symbols_workspace_idx").on(t.workspaceId),
  idxSymbolsComponent: index("symbols_component_idx").on(t.componentId),
}))

// ============================================================
// Symbol Pins
// ============================================================
export const symbolPins = pgTable("symbol_pins", {
  id: serial("id").primaryKey(),
  symbolId: integer("symbol_id").references(() => symbols.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  name: varchar("name", { length: 100 }),
  type: varchar("type", { length: 50 }),
  position: text("position"), // JSON text for position coordinates
  electricalType: varchar("electrical_type", { length: 50 }),
  evidenceId: integer("evidence_id").references(() => evidence.id, { onDelete: "set null" }),
}, (t) => ({
  idxPinsSymbol: index("pins_symbol_idx").on(t.symbolId),
}))

// ============================================================
// pgvector: document_embeddings
// ============================================================
// Embedding dimension configured via environment/DIMENSION env var (default: 384)
// This must match the embedding provider model dimension exactly.
// Stores pgvector embeddings for whole-document semantic search.
// Content hash tracking prevents redundant embedding generation.
export const documentEmbeddings = pgTable("document_embeddings", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  datasheetId: integer("datasheet_id").references(() => datasheets.id, { onDelete: "cascade" }),
  // Vector dimension configured by embedding model; must match provider exactly
  embedding: vector("embedding", { dimension: 384 }), // pgvector type
  contentHash: varchar("content_hash", { length: 64 }), // SHA-256 hash of embedding input
  embeddingModel: varchar("embedding_model", { length: 100 }), // e.g., "nvidia/nemotron"
  embeddingVersion: varchar("embedding_version", { length: 50 }), // model version
  embeddingDimension: integer("embedding_dimension").default(384),
  metric: varchar("metric", { length: 20 }).default("cosine"), // cosine | l2 | ip
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (t) => ({
  idxDocEmbedWorkspace: index("doc_emb_workspace_idx").on(t.workspaceId),
  idxDocEmbedDatasheet: index("doc_emb_datasheet_idx").on(t.datasheetId),
  idxDocEmbedHash: index("doc_emb_hash_idx").on(t.contentHash),
}))

// ============================================================
// pgvector: evidence_embeddings
// ============================================================
// Embedding for individual evidence records (fine-grained semantic search)
// Content hash prevents redundant embedding generation for unchanged evidence.
// Stores BOTH text and visual embeddings, distinguished by embeddingType.
// Text embeddings use the 'embedding' column; visual embeddings use the
// 'visual_embedding' column. This allows both to coexist per evidence record.
export const evidenceEmbeddings = pgTable("evidence_embeddings", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  evidenceId: integer("evidence_id").references(() => evidence.id, { onDelete: "cascade" }),
  // Text embedding for semantic search of evidence metadata
  embedding: vector("embedding", { dimension: 384 }), // pgvector type - TEXT embeddings
  // Visual embedding for image-based similarity search
  visualEmbedding: vector("visual_embedding", { dimension: 384 }), // pgvector type - VISUAL embeddings (nullable)
  // Content hash for text embedding dedup
  contentHash: varchar("content_hash", { length: 64 }), // SHA-256 hash of embedding input
  // Visual content hash for visual embedding dedup
  visualContentHash: varchar("visual_content_hash", { length: 64 }), // SHA-256 hash of image buffer
  embeddingModel: varchar("embedding_model", { length: 100 }), // e.g., "nvidia/nemotron"
  embeddingVersion: varchar("embedding_version", { length: 50 }), // model version
  // Text model tracking
  embeddingDimension: integer("embedding_dimension").default(384),
  // Visual model tracking
  visualEmbeddingModel: varchar("visual_embedding_model", { length: 100 }), // e.g., "clip-vit-base"
  visualEmbeddingVersion: varchar("visual_embedding_version", { length: 50 }), // model version
  visualEmbeddingDimension: integer("visual_embedding_dimension").default(384),
  metric: varchar("metric", { length: 20 }).default("cosine"), // cosine | l2 | ip
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (t) => ({
  idxEvidenceEmbedWorkspace: index("evidence_emb_workspace_idx").on(t.workspaceId),
  idxEvidenceEmbedEvidence: index("evidence_emb_evidence_idx").on(t.evidenceId),
  idxEvidenceEmbedHash: index("evidence_emb_hash_idx").on(t.contentHash),
  idxEvidenceVisualHash: index("evidence_visual_hash_idx").on(t.visualContentHash),
}))