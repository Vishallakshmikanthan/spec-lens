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
  SearchResultSet,
  SearchFilters,
  SearchHistoryEntry,
  ActivityEvent,
  AppNotificationSchema,
  VisualSearchResultSetSchema,
  VisualSearchFiltersSchema,
} from "@/lib/speclens/schema";
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
  SearchResultSet,
  SymbolSpec,
  User,
  Workspace,
} from "@/types/speclens";
import { z } from "zod";
import { EmbeddingProvider, EmbeddingConfig } from "@/lib/embedding/provider";
import { VisualEmbeddingProvider, VisualEmbeddingConfig } from "@/lib/visual-embedding/provider";
import type { SpecLensApi } from "./speclens-api";
import { executeSearch } from "@/lib/embedding/search-service";
import { executeVisualSearch } from "@/lib/visual-embedding/search-service";
import { qs, request, ApiError, type RequestOptions } from "./transport";

export type { SpecLensApi };

/**
 * List all processing jobs for the authenticated user's workspace.
 */
export async function listJobs(): Promise<ProcessingJob[]> {
  return request<ProcessingJob[]>("/api/jobs", { method: "GET" });
}

/**
 * Get a specific processing job by ID.
 */
export async function getJob(id: string): Promise<ProcessingJob | undefined> {
  return request<ProcessingJob>(`/api/jobs/${id}`, { method: "GET" });
}

/**
 * List all datasheets for the authenticated user's workspace.
 */
export async function listDatasheets(query?: string): Promise<Datasheet[]> {
  const params: Record<string, string | number | boolean | undefined> = {};
  if (query) {
    params.q = query;
  }
  return request<Datasheet[]>("/api/datasheets", { method: "GET", qs: params });
}

/**
 * Get a specific datasheet by ID.
 */
export async function getDatasheet(id: string): Promise<Datasheet | undefined> {
  return request<Datasheet>(`/api/datasheets/${id}`, { method: "GET" });
}

/**
 * Upload a datasheet PDF and start processing.
 * Note: This is handled by the POST /api/datasheets/upload H3 route,
 * but this method is kept for API contract compatibility.
 */
export async function uploadDatasheet(file: FormData): Promise<ProcessingJob> {
  return request<ProcessingJob>("/api/datasheets/upload", {
    method: "POST",
    body: file,
  });
}

/**
 * Index a datasheet (trigger the indexing pipeline).
 */
export async function indexDatasheet(id: string): Promise<{ jobId: string }> {
  return request<{ jobId: string }>(`/api/datasheets/${id}/index`, {
    method: "POST",
  });
}

/**
 * List all evidence records for the authenticated user's workspace.
 * Optionally filtered by documentId, evidence type, manufacturer, page, or minConfidence.
 */
export async function listEvidence(filters?: { documentId?: string; types?: EvidenceType[]; manufacturer?: string; page?: number; minConfidence?: number }): Promise<Evidence[]> {
  const params: Record<string, string | number | boolean | undefined> = {};
  if (filters?.documentId) params.documentId = filters.documentId;
  if (filters?.types?.length) params.types = filters.types.join(",");
  if (filters?.manufacturer) params.manufacturer = filters.manufacturer;
  if (filters?.page !== undefined) params.page = filters.page;
  if (filters?.minConfidence !== undefined) params.minConfidence = filters.minConfidence;
  return request<Evidence[]>("/api/evidence", { method: "GET", qs: params });
}

/**
 * Get a specific evidence record by ID.
 */
export async function getEvidence(id: string): Promise<Evidence | undefined> {
  return request<Evidence>(`/api/evidence/${id}`, { method: "GET" });
}