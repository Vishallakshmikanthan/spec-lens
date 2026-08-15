/**
 * Canonical processing-pipeline stage vocabulary.
 *
 * Both the upload UI and ProcessingJob.stages must use these machine-readable
 * stage keys. User-facing labels are defined in UPLOAD_STAGE_LABELS map below.
 * Frontend consumers should map internal keys to user labels via this lookup.
 *
 * Canonical order: validate → store → extract → render → layout → regions →
 * embed → index → verify → ready
 */
export const PROCESSING_STAGES = [
  { key: "validate", label: "PDF validated" },
  { key: "store", label: "Document stored" },
  { key: "extract", label: "Content extracted" },
  { key: "render", label: "Pages rendered" },
  { key: "layout", label: "Layout analyzed" },
  { key: "regions", label: "Visual regions detected" },
  { key: "embed", label: "Embedding" },
  { key: "index", label: "Vector indexing" },
  { key: "verify", label: "Evidence verification" },
  { key: "ready", label: "Ready" },
] as const;

export const UPLOAD_STAGE_LABELS = [
  { key: "validate", label: "PDF validated" },
  { key: "store", label: "Document stored" },
  { key: "extract", label: "Content extracted" },
  { key: "render", label: "Pages rendered" },
  { key: "layout", label: "Layout analyzed" },
  { key: "regions", label: "Visual regions detected" },
  { key: "embed", label: "Embedding" },
  { key: "index", label: "Building retrieval index" },
  { key: "verify", label: "Evidence verification" },
  { key: "ready", label: "Ready" },
] as const;

export type ProcessingStageKey = (typeof PROCESSING_STAGES)[number]["key"];
export type UploadStageKey = (typeof UPLOAD_STAGE_LABELS)[number]["key"];
