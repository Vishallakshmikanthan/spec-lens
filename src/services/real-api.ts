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
  SymbolSpec,
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

// NOTE: In a full implementation, the provider would be injected/configured
// per-environment. For now we define a stub that the backend would implement.
// The UI (DEMO_MODE) uses mockApi; the real backend uses this structure.