/**
 * SpecLens API contract.
 *
 * The typed service interface is the single integration point between the UI
 * and whichever implementation is active (mock today, real backend tomorrow).
 * Every method maps 1:1 to a planned backend endpoint — documented below.
 * The selection between implementations happens in src/services/index.ts and
 * is driven by DEMO_MODE in src/lib/speclens/config.ts.
 *
 *   POST /api/datasheets/upload      -> uploadDatasheet
 *   GET  /api/datasheets             -> listDatasheets
 *   GET  /api/datasheets/:id         -> getDatasheet
 *   POST /api/datasheets/:id/index   -> indexDatasheet
 *   GET  /api/jobs                   -> listJobs
 *   GET  /api/jobs/:id               -> getJob
 *   POST /api/search                 -> search
 *   GET  /api/evidence               -> listEvidence
 *   GET  /api/evidence/:id           -> getEvidence
 *   GET  /api/components/:mpn        -> getComponent
 *   POST /api/copilot                -> askCopilot
 *   POST /api/symbols/generate       -> generateSymbol
 *   GET  /api/analytics              -> getAnalytics
 *   GET  /api/collections            -> listCollections
 *   GET  /api/session                -> getSession
 *   GET  /api/activity               -> listActivity
 *   GET  /api/notifications          -> listNotifications
 *   GET  /api/history                -> listHistory
 *
 * None of these endpoints are assumed to exist yet; the mock implementation
 * satisfies the interface so the UI can run in DEMO_MODE end-to-end.
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

export interface UploadFileInput {
  /** FormData for real API multipart/upload */
  file?: FormData;
  /** Legacy file info for mock API */
  name?: string;
  size?: number;
}

export interface SpecLensApi {
  listDatasheets(query?: string): Promise<Datasheet[]>;
  getDatasheet(id: string): Promise<Datasheet | undefined>;
  uploadDatasheet(file: UploadFileInput): Promise<ProcessingJob>;
  indexDatasheet(id: string): Promise<{ jobId: string }>;
  listJobs(): Promise<ProcessingJob[]>;
  getJob(id: string): Promise<ProcessingJob | undefined>;
  search(query: string, filters?: SearchFilters): Promise<SearchResultSet>;
  getEvidence(id: string): Promise<Evidence | undefined>;
  listEvidence(documentId?: string): Promise<Evidence[]>;
  getComponent(mpn: string): Promise<ComponentIntel | undefined>;
  askCopilot(question: string): Promise<CopilotMessage>;
  generateSymbol(mpn: string): Promise<SymbolSpec>;
  getAnalytics(): Promise<Analytics>;
  listCollections(): Promise<Collection[]>;
  getSession(): Promise<{ user: User; workspaces: Workspace[] }>;
  listActivity(): Promise<ActivityEvent[]>;
  listNotifications(): Promise<AppNotification[]>;
  listHistory(): Promise<SearchHistoryEntry[]>;
  auth: {
    login: (email: string, password: string) => Promise<{ authenticated: boolean; statusMessage?: string }>;
    signup: (name: string, email: string, password: string, passwordConfirmation: string, workspaceName?: string) => Promise<{ authenticated: boolean; statusMessage?: string }>;
    logout: () => Promise<{ authenticated: boolean }>;
    session: () => Promise<{ authenticated: boolean; user?: any; workspace?: any; memberships?: any[] }>;
  };
}
