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

/** A structured text block extracted from a PDF document page. */
export interface DocumentTextBlock {
  id: string;
  documentId: string;
  page: number;
  blockType: "heading" | "paragraph" | "table" | "caption" | "list" | "footnote" | "header" | "footer" | "unknown";
  text: string;
  bbox: BoundingBox;
  readingOrder: number;
  confidence: number;
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

/** Filters for visual search API. */
export interface VisualSearchFilters {
  types?: EvidenceType[];
  manufacturer?: string;
  documentId?: string;
  minConfidence?: number;
  page?: number | null;
}

/** Results from a visual search. */
export interface VisualSearchResult {
  rank: number;
  evidence: Evidence;
  visualSimilarity: number;
  confidence: number;
  retrievalScore: number;
}

/** A ranked evidence hit returned by visual search. */
export interface VisualSearchResultSet {
  queryImageName: string;
  latencyMs: number;
  total: number;
  results: VisualSearchResult[];
  facets: { type: EvidenceType; count: number }[];
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
  duration: string;
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

export interface SourceReference {
  evidenceId: string;
  page: number;
  label: string;
  confidence: number;
}

export interface EvidenceCitation {
  source: SourceReference;
  excerpt?: string;
  relevance: number;
}

export interface CopilotAnswer {
  id: string;
  role: "assistant";
  content: string;
  sources: SourceReference[];
  confidence: number;
  pending?: boolean;
}

export interface CopilotService {
  ask(question: string): Promise<CopilotAnswer>;
  getSuggestedQuestions(): Promise<string[]>;
}

export interface SymbolPin {
  pinNumber: string;
  name: string;
  type: "signal" | "power" | "ground" | "input" | "output" | "nc";
  direction: "in" | "out" | "bidirectional";
  x: number;
  y: number;
  length: number;
  electricalType: string;
  description: string;
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

export interface CircuitComponent {
  id: string;
  mpn: string;
  reference: string;
  value: string;
  package: string;
  symbol: string;
  evidenceIds: string[];
}

export interface CircuitConnection {
  from: string;
  to: string;
  net: string;
}

export interface CircuitParameter {
  name: string;
  value: string;
  units: string;
  formula?: string;
  inputs?: Record<string, string>;
  result?: string;
}

export interface CircuitSpec {
  id: string;
  mpn: string;
  title: string;
  description: string;
  components: CircuitComponent[];
  connections: CircuitConnection[];
  nets: string[];
  parameters: CircuitParameter[];
  assumptions: string[];
  warnings: string[];
  sources: { evidenceId: string; label: string; confidence: number }[];
}

export type CircuitGenerationStatus = "idle" | "generating" | "completed" | "failed";

export interface SymbolVersion {
  version: string;
  createdAt: string;
  createdBy: string;
  sourceEvidence: string;
  validationStatus: "passed" | "failed" | "pending";
  symbolSpec: SymbolSpec;
}

export interface CircuitVersion {
  version: string;
  createdAt: string;
  createdBy: string;
  sourceEvidence: string;
  validationStatus: "passed" | "failed" | "pending";
  circuitSpec: CircuitSpec;
}

export interface CircuitComponent {
  id: string;
  mpn: string;
  reference: string;
  value: string;
  package: string;
  symbol: string;
  evidenceIds: string[];
}

export interface CircuitConnection {
  from: string;
  to: string;
  net: string;
}

export interface CircuitParameter {
  name: string;
  value: string;
  units: string;
  formula?: string;
  inputs?: Record<string, string>;
  result?: string;
}

export interface CircuitSpec {
  id: string;
  mpn: string;
  title: string;
  description: string;
  components: CircuitComponent[];
  connections: CircuitConnection[];
  nets: string[];
  parameters: CircuitParameter[];
  assumptions: string[];
  warnings: string[];
  sources: { evidenceId: string; label: string; confidence: number }[];
}

export type CircuitGenerationStatus = "idle" | "generating" | "completed" | "failed";

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

export interface CommandCenterMetric {
  label: string;
  value: string;
  delta?: { text: string; positive: boolean };
  hint?: string;
}

export interface PipelineStage {
  label: string;
  caption: string;
  count: string;
  verified?: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  tone: "success" | "info" | "error";
  at: string;
  read: boolean;
}
