/**
 * Real backend implementation of SpecLensApi.
 *
 * Not exercised while DEMO_MODE is true (src/services/index.ts selects the
 * mock). These methods are typed fetch wrappers over the planned endpoints
 * declared in src/services/speclens-api.ts. Responses are validated via Zod
 * schemas in src/lib/speclens/schema.ts before being returned to UI code.
 *
 * Architecture: UI → api → realApi → transport → backend
 */

import type {
  ActivityEvent,
  Analytics,
  AppNotification,
  Collection,
  ComponentIntel,
  CopilotMessage,
  Datasheet,
  Evidence,
  ProcessingJob,
  SearchFilters,
  SearchHistoryEntry,
  SearchResultSet,
  SymbolSpec,
  User,
  Workspace,
} from "@/types/speclens";
import { qs, request, ApiError, type RequestOptions } from "./transport";
import type { SpecLensApi } from "./speclens-api";
import { z } from "zod";
import {
  UserSchema,
  WorkspaceSchema,
  DatasheetSchema,
  EvidenceSchema,
  SearchResultSetSchema,
  SearchFiltersSchema,
  ComponentIntelSchema,
  CollectionSchema,
  ProcessingJobSchema,
  AnalyticsSchema,
  CopilotMessageSchema,
  SymbolSpecSchema,
  SearchHistoryEntrySchema,
  ActivityEventSchema,
  AppNotificationSchema,
} from "@/lib/speclens/schema";

/**
 * Parse and validate a backend response using Zod.
 * Throws a normalized ApiError with context if validation fails.
 */
function parseResponse<T extends z.ZodTypeAny>(
  response: unknown,
  schema: T,
  endpoint: string,
): z.infer<T> {
  try {
    return schema.parse(response);
  } catch (err) {
    const issue = err instanceof Error ? err.message : String(err);
    throw new ApiError(
      502,
      "validation_error",
      `Response validation failed for ${endpoint}: ${issue}`,
      { received: String(response).slice(0, 200) },
    );
  }
}

export const realApi: SpecLensApi = {
  listDatasheets: (query = "") =>
    request<Datasheet[]>(`/datasheets${qs({ q: query || undefined })}`).then((data) =>
      parseResponse(data, DatasheetSchema, "listDatasheets"),
    ),

  getDatasheet: (id) =>
    request<Datasheet>(`/datasheets/${encodeURIComponent(id)}`).then((data) =>
      parseResponse(data, DatasheetSchema, `getDatasheet/${id}`),
    ),

  uploadDatasheet: (file) =>
    request<ProcessingJob>("/datasheets/upload", { method: "POST", body: file }).then((data) =>
      parseResponse(data, ProcessingJobSchema, `uploadDatasheet`),
    ),

  indexDatasheet: (id) =>
    request<{ jobId: string }>(`/datasheets/${encodeURIComponent(id)}/index`, {
      method: "POST",
    }).then((data) => parseResponse(data, z.object({ jobId: z.string() }), `indexDatasheet/${id}`)),

  listJobs: () =>
    request<ProcessingJob[]>("/jobs").then((data) =>
      parseResponse(data, ProcessingJobSchema, "listJobs"),
    ),

  getJob: (id) =>
    request<ProcessingJob>(`/jobs/${encodeURIComponent(id)}`).then((data) =>
      parseResponse(data, ProcessingJobSchema, `getJob/${id}`),
    ),

  search: (query, filters: SearchFilters = {}) =>
    request<SearchResultSet>("/search", { method: "POST", body: { query, ...filters } }).then(
      (data) => parseResponse(data, SearchResultSetSchema, `search/${query}`),
    ),

  getEvidence: (id) =>
    request<Evidence>(`/evidence/${encodeURIComponent(id)}`).then((data) =>
      parseResponse(data, EvidenceSchema, `getEvidence/${id}`),
    ),

  listEvidence: (documentId) =>
    request<Evidence[]>(`/evidence${qs({ documentId })}`).then((data) =>
      parseResponse(data, EvidenceSchema, `listEvidence/${documentId}`),
    ),

  getComponent: (mpn) =>
    request<ComponentIntel>(`/components/${encodeURIComponent(mpn)}`).then((data) =>
      parseResponse(data, ComponentIntelSchema, `getComponent/${mpn}`),
    ),

  askCopilot: (question) =>
    request<CopilotMessage>("/copilot", { method: "POST", body: { question } }).then((data) =>
      parseResponse(data, CopilotMessageSchema, `askCopilot`),
    ),

  generateSymbol: (mpn) =>
    request<SymbolSpec>("/symbols/generate", { method: "POST", body: { mpn } }).then((data) =>
      parseResponse(data, SymbolSpecSchema, `generateSymbol/${mpn}`),
    ),

  getAnalytics: () =>
    request<Analytics>("/analytics").then((data) =>
      parseResponse(data, AnalyticsSchema, "getAnalytics"),
    ),

  listCollections: () =>
    request<Collection[]>("/collections").then((data) =>
      parseResponse(data, CollectionSchema, "listCollections"),
    ),

  getSession: () =>
    request<{ user: User; workspaces: Workspace[] }>("/session").then((data) =>
      parseResponse(
        data,
        z.object({
          user: UserSchema,
          workspaces: z.array(WorkspaceSchema),
        }),
        "getSession",
      ),
    ),

  listActivity: () =>
    request<ActivityEvent[]>("/activity").then((data) =>
      parseResponse(data, z.array(ActivityEventSchema), "listActivity"),
    ),

  listNotifications: () =>
    request<AppNotification[]>("/notifications").then((data) =>
      parseResponse(data, z.array(AppNotificationSchema), "listNotifications"),
    ),

  listHistory: () =>
    request<SearchHistoryEntry[]>("/history").then((data) =>
      parseResponse(data, SearchHistoryEntrySchema, "listHistory"),
    ),
};
