/**
 * Zod runtime validation schemas for the SpecLens API boundary.
 *
 * Backend JSON → schema.parse() → trusted frontend domain object.
 * If a backend response is malformed, schema.parse throws a structured error
 * instead of silently rendering corrupted data.
 *
 * Prefer: z.infer<typeof SomeSchema> so TypeScript types and runtime validation
 * do not drift apart.
 *
 * The canonical domain types live in src/types/speclens.ts and are re-exported
 * via src/lib/speclens/types.ts → "@/types/speclens".
 * These schemas correspond to those types at the runtime level.
 * Type-level correspondence is achieved via z.infer<typeof SomeSchema>.
 */

import { z } from "zod";

/* -------------------------------------------------------------------------
 * Core user & workspace
 * -------------------------------------------------------------------------*/

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["Student", "Researcher", "Engineer", "Engineering Team", "Organization"]),
  initials: z.string(),
});

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  plan: z.string(),
  members: z.number(),
});

/* -------------------------------------------------------------------------
 * Datasheet — use string enums directly rather than Zod nativeEnum
 * to avoid EnumLike assignability issues.
 * -------------------------------------------------------------------------*/

export const DatasheetSchema = z.object({
  id: z.string(),
  mpn: z.string(),
  manufacturer: z.string(),
  title: z.string(),
  fileName: z.string(),
  pages: z.number(),
  sizeMb: z.number(),
  status: z.enum(["indexed", "indexing", "queued", "failed"]),
  evidenceCount: z.number(),
  updatedAt: z.string(),
  favorite: z.boolean(),
  collections: z.array(z.string()),
  accent: z.enum(["cyan", "violet", "amber", "green"]),
});

/* -------------------------------------------------------------------------
 * Document & Page
 * -------------------------------------------------------------------------*/

export const DocumentSchema = z.object({
  id: z.string(),
  datasheetId: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  pageCount: z.number(),
  sizeBytes: z.number(),
  indexedAt: z.string(),
});

export const PageSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  number: z.number(),
  width: z.number(),
  height: z.number(),
  renderedUri: z.string().optional(),
});

/* -------------------------------------------------------------------------
 * Evidence
 * -------------------------------------------------------------------------*/

export const EvidenceSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  mpn: z.string(),
  manufacturer: z.string(),
  title: z.string(),
  type: z.enum([
    "pinout",
    "package",
    "block-diagram",
    "timing",
    "application-circuit",
    "electrical-curve",
    "mechanical",
    "absolute-maximum",
    "functional-diagram",
    "other",
  ]),
  page: z.number(),
  totalPages: z.number(),
  bbox: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  }),
  confidence: z.number(),
  verification: z.enum(["verified", "unverified", "flagged"]),
  caption: z.string(),
  cropUri: z.string(),
  matchedBy: z.array(z.string()),
  retrievalScore: z.number(),
  modelVersion: z.string(),
  timestamp: z.string(),
});

/* -------------------------------------------------------------------------
 * Search
 * -------------------------------------------------------------------------*/

export const SearchResultSchema = z.object({
  rank: z.number(),
  evidence: EvidenceSchema,
  retrievalScore: z.number(),
  matchedBy: z.array(z.string()),
});

export const SearchResultSetSchema = z.object({
  query: z.string(),
  latencyMs: z.number(),
  total: z.number(),
  results: z.array(EvidenceSchema),
  facets: z.array(
    z.object({
      type: z.enum([
        "pinout",
        "package",
        "block-diagram",
        "timing",
        "application-circuit",
        "electrical-curve",
        "mechanical",
        "absolute-maximum",
        "functional-diagram",
        "other",
      ]),
      count: z.number(),
    }),
  ),
});

export const SearchFiltersSchema = z
  .object({
    types: z
      .array(
        z.enum([
          "pinout",
          "package",
          "block-diagram",
          "timing",
          "application-circuit",
          "electrical-curve",
          "mechanical",
          "absolute-maximum",
          "functional-diagram",
          "other",
        ]),
      )
      .optional(),
    manufacturer: z.string().optional(),
    documentId: z.string().optional(),
    minConfidence: z.number().optional(),
    page: z.number().optional(),
  })
  .strict();

/* -------------------------------------------------------------------------
 * Component & ComponentIntel
 * -------------------------------------------------------------------------*/

export const ComponentSchema = z.object({
  id: z.string(),
  mpn: z.string(),
  manufacturer: z.string(),
  family: z.string(),
  category: z.string(),
  description: z.string(),
  packages: z.array(z.string()),
});

export const ComponentIntelSchema = z.object({
  mpn: z.string(),
  manufacturer: z.string(),
  family: z.string(),
  description: z.string(),
  packages: z.array(z.string()),
  channels: z.number(),
  specs: z.array(z.object({ label: z.string(), value: z.string() })),
  verified: z.array(
    z.object({
      type: z.enum([
        "pinout",
        "package",
        "block-diagram",
        "timing",
        "application-circuit",
        "electrical-curve",
        "mechanical",
        "absolute-maximum",
        "functional-diagram",
        "other",
      ]),
      label: z.string(),
      ok: z.boolean(),
    }),
  ),
  related: z.array(z.object({ mpn: z.string(), note: z.string() })),
  history: z.array(z.object({ at: z.string(), event: z.string() })),
});

/* -------------------------------------------------------------------------
 * Collection & ProcessingJob
 * -------------------------------------------------------------------------*/

export const CollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  datasheets: z.number(),
  evidence: z.number(),
  components: z.number(),
  updatedAt: z.string(),
});

export const JobStageSchema = z.object({
  key: z.string(),
  label: z.string(),
  state: z.enum(["done", "active", "pending", "failed"]),
});

export const ProcessingJobSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  mpn: z.string(),
  status: z.enum(["queued", "processing", "complete", "failed"]),
  progress: z.number(),
  pages: z.number(),
  sizeMb: z.number(),
  stages: z.array(JobStageSchema),
  logs: z.array(
    z.object({
      at: z.string(),
      line: z.string(),
      level: z.enum(["info", "warn", "error"]).optional(),
    }),
  ),
  startedAt: z.string(),
  duration: z.string(),
});

/* -------------------------------------------------------------------------
 * Analytics
 * -------------------------------------------------------------------------*/

export const AnalyticsMetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  delta: z.object({ text: z.string(), positive: z.boolean() }),
  hint: z.string().optional(),
});

export const AnalyticsRetrievalDaySchema = z.object({
  day: z.string(),
  precision: z.number(),
  recall: z.number(),
});

export const AnalyticsEvidenceDistributionSchema = z.object({
  type: z.string(),
  count: z.number(),
});

export const AnalyticsQueryTypeSchema = z.object({
  name: z.string(),
  value: z.number(),
});

export const AnalyticsThroughputHourSchema = z.object({
  hour: z.string(),
  pages: z.number(),
});

export const AnalyticsConfidenceBucketSchema = z.object({
  bucket: z.string(),
  count: z.number(),
});

export const AnalyticsSchema = z.object({
  metrics: z.array(AnalyticsMetricSchema),
  retrieval: z.array(AnalyticsRetrievalDaySchema),
  evidenceDistribution: z.array(AnalyticsEvidenceDistributionSchema),
  queryTypes: z.array(AnalyticsQueryTypeSchema),
  throughput: z.array(AnalyticsThroughputHourSchema),
  confidence: z.array(AnalyticsConfidenceBucketSchema),
});

/* -------------------------------------------------------------------------
 * Copilot
 * -------------------------------------------------------------------------*/

export const CopilotSourceSchema = z.object({
  evidenceId: z.string(),
  page: z.number(),
  label: z.string(),
  confidence: z.number(),
});

export const CopilotMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  sources: z.array(CopilotSourceSchema).optional(),
  confidence: z.number().optional(),
  pending: z.boolean().optional(),
});

/* -------------------------------------------------------------------------
 * SymbolSpec
 * -------------------------------------------------------------------------*/

export const SymbolPinSchema = z.object({
  number: z.string(),
  name: z.string(),
  electrical: z.string(),
  side: z.enum(["left", "right", "top", "bottom"]),
  evidenceId: z.string(),
});

export const SymbolSpecSchema = z.object({
  mpn: z.string(),
  package: z.string(),
  pins: z.array(SymbolPinSchema),
  validation: z.array(z.object({ label: z.string(), ok: z.boolean() })),
  stage: z.enum(["spec", "validation", "compilation", "preview"]),
});

/* -------------------------------------------------------------------------
 * SearchHistoryEntry
 * -------------------------------------------------------------------------*/

export const SearchHistoryEntrySchema = z.object({
  id: z.string(),
  query: z.string(),
  mpn: z.string(),
  results: z.number(),
  bestConfidence: z.number(),
  at: z.string(),
});

/* -------------------------------------------------------------------------
 * ActivityEvent
 * -------------------------------------------------------------------------*/

export const ActivityEventSchema = z.object({
  id: z.string(),
  kind: z.enum(["index", "detect", "query", "verify", "error"]),
  title: z.string(),
  detail: z.string(),
  at: z.string(),
});

export const SearchHistoryEntrySchema = z.object({
  id: z.string(),
  query: z.string(),
  mpn: z.string(),
  results: z.number(),
  bestConfidence: z.number(),
  at: z.string(),
});

/* -------------------------------------------------------------------------
 * Visual Search
 * -------------------------------------------------------------------------*/

export const VisualSearchResultSchema = z.object({
  evidence: EvidenceSchema,
  visualSimilarity: z.number(),
  confidence: z.number(),
  retrievalScore: z.number(),
});

export const VisualSearchResultSetSchema = z.object({
  queryImageId: z.string(),
  latencyMs: z.number(),
  total: z.number(),
  results: z.array(VisualSearchResultSchema),
  facets: z.array(
    z.object({
      type: z.enum([
        "pinout",
        "package",
        "block-diagram",
        "timing",
        "application-circuit",
        "electrical-curve",
        "mechanical",
        "absolute-maximum",
        "functional-diagram",
        "other",
      ]),
      count: z.number(),
    }),
  ),
});

export const VisualSearchFiltersSchema = z.object({
  types: z
    .array(
      z.enum([
        "pinout",
        "package",
        "block-diagram",
        "timing",
        "application-circuit",
        "electrical-curve",
        "mechanical",
        "absolute-maximum",
        "functional-diagram",
        "other",
      ]),
    )
    .optional(),
  manufacturer: z.string().optional(),
  documentId: z.string().optional(),
  minConfidence: z.number().optional(),
  page: z.number().optional(),
})
  .strict();

/* -------------------------------------------------------------------------
 * AppNotification
 * -------------------------------------------------------------------------*/

export const AppNotificationSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  tone: z.enum(["success", "info", "error"]),
  at: z.string(),
  read: z.boolean(),
});

/* -------------------------------------------------------------------------
 * Export only schema values. Do NOT export type aliases that conflict
 * with the canonical types in src/types/speclens.ts. Use
 * z.infer<typeof SomeSchema> at the call site for type-level correspondence.
 * -------------------------------------------------------------------------*/

export { z };

/* -------------------------------------------------------------------------
 * Export inferred types for convenience. These are secondary — the primary
 * source of truth is the Zod schema and the canonical types from
 * "@/types/speclens".
 * -------------------------------------------------------------------------*/

export type User = z.infer<typeof UserSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type Datasheet = z.infer<typeof DatasheetSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type SearchResultSet = z.infer<typeof SearchResultSetSchema>;
export type SearchFilters = z.infer<typeof SearchFiltersSchema>;
export type ComponentIntel = z.infer<typeof ComponentIntelSchema>;
export type Collection = z.infer<typeof CollectionSchema>;
export type ProcessingJob = z.infer<typeof ProcessingJobSchema>;
export type Analytics = z.infer<typeof AnalyticsSchema>;
export type CopilotMessage = z.infer<typeof CopilotMessageSchema>;
export type SymbolSpec = z.infer<typeof SymbolSpecSchema>;
export type SearchHistoryEntry = z.infer<typeof SearchHistoryEntrySchema>;
export type ActivityEvent = z.infer<typeof ActivityEventSchema>;
export type AppNotification = z.infer<typeof AppNotificationSchema>;
export type VisualSearchResultSet = z.infer<typeof VisualSearchResultSetSchema>;
export type VisualSearchFilters = z.infer<typeof VisualSearchFiltersSchema>;
