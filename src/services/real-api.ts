/**
 * Real backend implementation of SpecLensApi.
 *
 * Not exercised while DEMO_MODE is true (src/services/index.ts selects the
 * mock). These methods are thin typed fetch wrappers over the planned
 * endpoints declared in src/services/speclens-api.ts. Nothing here assumes
 * an endpoint exists today — a 404/connection failure surfaces as an ApiError
 * which the UI's ErrorState components can render.
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
import { qs, request } from "./transport";
import type { SpecLensApi } from "./speclens-api";

export const realApi: SpecLensApi = {
  listDatasheets: (query = "") =>
    request<Datasheet[]>(`/datasheets${qs({ q: query || undefined })}`),

  getDatasheet: (id) => request<Datasheet>(`/datasheets/${encodeURIComponent(id)}`),

  uploadDatasheet: (file) =>
    request<ProcessingJob>("/datasheets/upload", { method: "POST", body: file }),

  indexDatasheet: (id) =>
    request<{ jobId: string }>(`/datasheets/${encodeURIComponent(id)}/index`, { method: "POST" }),

  listJobs: () => request<ProcessingJob[]>("/jobs"),

  getJob: (id) => request<ProcessingJob>(`/jobs/${encodeURIComponent(id)}`),

  search: (query, filters: SearchFilters = {}) =>
    request<SearchResultSet>("/search", { method: "POST", body: { query, ...filters } }),

  getEvidence: (id) => request<Evidence>(`/evidence/${encodeURIComponent(id)}`),

  listEvidence: (documentId) => request<Evidence[]>(`/evidence${qs({ documentId })}`),

  getComponent: (mpn) => request<ComponentIntel>(`/components/${encodeURIComponent(mpn)}`),

  askCopilot: (question) =>
    request<CopilotMessage>("/copilot", { method: "POST", body: { question } }),

  generateSymbol: (mpn) =>
    request<SymbolSpec>("/symbols/generate", { method: "POST", body: { mpn } }),

  getAnalytics: () => request<Analytics>("/analytics"),

  listCollections: () => request<Collection[]>("/collections"),

  getSession: () => request<{ user: User; workspaces: Workspace[] }>("/session"),

  listActivity: () => request<ActivityEvent[]>("/activity"),

  listNotifications: () => request<AppNotification[]>("/notifications"),

  listHistory: () => request<SearchHistoryEntry[]>("/history"),
};
