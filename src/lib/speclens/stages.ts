/**
 * Canonical processing-pipeline stage vocabulary.
 *
 * The audit flagged that the upload page and ProcessingJob.stages used two
 * divergent label sets. These are the canonical machine stage keys; user-facing
 * label mapping lives next to each consumer until the backend commits to one
 * vocabulary.
 */
export const PROCESSING_STAGES = [
  { key: "ingest", label: "PDF ingestion" },
  { key: "render", label: "Page rendering" },
  { key: "layout", label: "Layout analysis" },
  { key: "regions", label: "Region detection" },
  { key: "embed", label: "Embedding" },
  { key: "index", label: "Vector indexing" },
  { key: "verify", label: "Verification" },
] as const;

export const UPLOAD_STAGE_LABELS = [
  { key: "validate", label: "PDF validated" },
  { key: "load", label: "Document loaded" },
  { key: "render", label: "Pages rendered" },
  { key: "layout", label: "Layout analyzed" },
  { key: "regions", label: "Visual regions detected" },
  { key: "index", label: "Building retrieval index" },
  { key: "verify", label: "Evidence verification" },
  { key: "ready", label: "Ready" },
] as const;

export type ProcessingStageKey = (typeof PROCESSING_STAGES)[number]["key"];
export type UploadStageKey = (typeof UPLOAD_STAGE_LABELS)[number]["key"];
