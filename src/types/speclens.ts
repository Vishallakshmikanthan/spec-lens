/**
 * SpecLens domain model — canonical source of truth.
 * These types mirror the planned backend API contract (see src/services/speclens-api.ts).
 *
 * Import from "@/types/speclens" or "@/types". The legacy path
 * "@/lib/speclens/types" still works as a compatibility re-export.
 */

export type UserRole = "Student" | "Researcher" | "Engineer" | "Engineering Team" | "Organization";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  initials: string;
}

export interface Workspace {
  id: string;
  name: string;
  plan: string;
  members: number;
}

export type IndexStatus = "indexed" | "indexing" | "queued" | "failed";

export interface Datasheet {
  id: string;
  mpn: string;
  manufacturer: string;
  title: string;
  fileName: string;
  pages: number;
  sizeMb: number;
  status: IndexStatus;
  evidenceCount: number;
  updatedAt: string;
  favorite: boolean;
  collections: string[];
  accent: "cyan" | "violet" | "amber" | "green";
}

/** A rendered/indexed PDF file that backs a Datasheet. */
export interface Document {
  id: string;
  datasheetId: string;
  fileName: string;
  mimeType: string;
  pageCount: number;
  sizeBytes: number;
  indexedAt: string;
}

/** A single page within a Document, in a stable pixel coordinate space. */
export interface Page {
  id: string;
  documentId: string;
  number: number;
  width: number;
  height: number;
  renderedUri?: string;
}

export type EvidenceType =
  | "pinout"
  | "package"
  | "block-diagram"
  | "timing"
  | "application-circuit"
  | "electrical-curve"
  | "mechanical"
  | "table"
  | "absolute-maximum"
  | "functional-diagram"
  | "other";

export interface BoundingBox {
  /** normalized 0..1 relative to page */
  x: number;
  y: number;
  w: number;
  h: number;
}

export type VerificationState = "verified" | "unverified" | "flagged";

export interface Evidence {
  id: string;
  documentId: string;
  mpn: string;
  manufacturer: string;
  title: string;
  type: EvidenceType;
  page: number;
  totalPages: number;
  bbox: BoundingBox;
  confidence: number;
  verification: VerificationState;
  caption: string;
  cropUri: string;
  matchedBy: string[];
  retrievalScore: number;
  modelVersion: string;
  timestamp: string;
}

/** A ranked evidence hit returned by visual search. */
export interface SearchResult {
  rank: number;
  evidence: Evidence;
  retrievalScore: number;
  matchedBy: string[];
}

export interface SearchResultSet {
  query: string;
  latencyMs: number;
  total: number;
  results: Evidence[];
  facets: { type: EvidenceType; count: number }[];
}

export interface SearchFilters {
  types?: EvidenceType[];
  manufacturer?: string;
  documentId?: string;
  minConfidence?: number;
  page?: number | null;
}

/** Lean component identity used in lists and pickers. */
export interface Component {
  id: string;
  mpn: string;
  manufacturer: string;
  family: string;
  category: string;
  description: string;
  packages: string[];
}

export interface ComponentIntel {
  mpn: string;
  manufacturer: string;
  family: string;
  description: string;
  packages: string[];
  channels: number;
  specs: { label: string; value: string }[];
  verified: { type: EvidenceType; label: string; ok: boolean }[];
  related: { mpn: string; note: string }[];
  history: { at: string; event: string }[];
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  datasheets: number;
  evidence: number;
  components: number;
  updatedAt: string;
}

export type JobStageState = "done" | "active" | "pending" | "failed";

export interface JobStage {
  key: string;
  label: string;
  state: JobStageState;
}

export interface ProcessingJob {
  id: string;
  fileName: string;
  mpn: string;
  status: "queued" | "processing" | "complete" | "failed";
  progress: number;
  pages: number;
  sizeMb: number;
  stages: JobStage[];
  logs: { at: string; line: string; level?: "info" | "warn" | "error" }[];
  startedAt: string;
}

export interface Analytics {
  metrics: { label: string; value: string; delta: string; positive: boolean }[];
  retrieval: { day: string; precision: number; recall: number }[];
  evidenceDistribution: { type: string; count: number }[];
  queryTypes: { name: string; value: number }[];
  throughput: { hour: string; pages: number }[];
  confidence: { bucket: string; count: number }[];
}

export interface CopilotSource {
  evidenceId: string;
  page: number;
  label: string;
  confidence: number;
}

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: CopilotSource[];
  confidence?: number;
  pending?: boolean;
}

export interface SymbolPin {
  number: string;
  name: string;
  electrical: string;
  side: "left" | "right" | "top" | "bottom";
  evidenceId: string;
}

export interface SymbolSpec {
  mpn: string;
  package: string;
  pins: SymbolPin[];
  validation: { label: string; ok: boolean }[];
  stage: "spec" | "validation" | "compilation" | "preview";
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  mpn: string;
  results: number;
  bestConfidence: number;
  at: string;
}

export interface ActivityEvent {
  id: string;
  kind: "index" | "detect" | "query" | "verify" | "error";
  title: string;
  detail: string;
  at: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  tone: "success" | "info" | "error";
  at: string;
  read: boolean;
}
