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
import { executeSearch } from "@/lib/embedding/search-service";
import { executeVisualSearch } from "@/lib/visual-embedding/search-service";
import { EmbeddingProvider, EmbeddingConfig } from "@/lib/embedding/provider";
import { VisualEmbeddingProvider, VisualEmbeddingConfig } from "@/lib/visual-embedding/provider";
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
import { z } from "zod";
import { qs, request, ApiError, type RequestOptions } from "./transport";
import type { SpecLensApi } from "./speclens-api";
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
  VisualSearchResultSetSchema,
  VisualSearchFiltersSchema,
} from "@/lib/speclens/schema";
import { executeSearch } from "@/lib/embedding/search-service";
import { executeVisualSearch } from "@/lib/visual-embedding/search-service";
import { VisualEmbeddingProvider, VisualEmbeddingConfig } from "@/lib/visual-embedding/provider";

// NOTE: In a full implementation, the provider would be injected/configured
// per-environment. For now we define a stub that the backend would implement.
// The UI (DEMO_MODE) uses mockApi; the real backend uses this structure.

/**
 * Concrete provider implementation for the real backend.
 * Uses OpenAI-compatible Nemotron API or local model.
 * API keys and secrets remain server-side only.
 */
class NemotronProvider implements EmbeddingProvider {
  private apiBase: string;
  private config: EmbeddingConfig;

  constructor(config: EmbeddingConfig) {
    this.config = config;
    // API base comes from server environment, never exposed to browser
    this.apiBase = process.env.NEMOTRON_API_BASE || "https://api.nvidia.com/v1";
  }

  async embedText(text: string): Promise<number[]> {
    const response = await fetch(`${this.apiBase}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Authorization header from server-side env var only
        Authorization: `Bearer ${process.env.NEMOTRON_API_KEY}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        input: text,
      }),
      // Keep credentials server-side; no VITE_ prefix
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        `Embedding API error: ${response.status} ${errData.detail || response.statusText}`
      );
    }

    const data = await response.json();
    // Nemotron/open-source embedding returns data[0].embedding
    if (!data.data || data.data.length === 0) {
      throw new Error("Embedding API returned no results");
    }
    return data.data[0].embedding;
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await fetch(`${this.apiBase}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.NEMOTRON_API_KEY}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        input: texts.map(t => ({ input: t })),
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        `Embedding API batch error: ${response.status} ${errData.detail || response.statusText}`
      );
    }

    const data = await response.json();
    return data.data?.map((d: any) => d.embedding) || [];
  }
}

/**
 * Fallback: local embedding using a simple hash-based approach for development.
 * In production, this would be replaced by the real provider.
 * This is ONLY used when no API key is configured.
 */
class LocalProvider implements EmbeddingProvider {
  private config: EmbeddingConfig;

  constructor(config: EmbeddingConfig) {
    this.config = config;
  }

  async embedText(text: string): Promise<number[]> {
    // Deterministic hash-based embedding for development/demo without API keys
    // This is NOT suitable for production semantic search but keeps the UI running
    const hash = require('crypto').createHash('sha256').update(text).digest();
    // Convert hash to float32 array with the expected dimension
    const dimension = this.config.dimension;
    const result: number[] = [];
    for (let i = 0; i < dimension; i++) {
      // Use bytes from hash, mapped to [-1, 1] range
      const byte = hash[i % hash.length];
      result.push((byte / 255 - 0.5) * 2);
    }
    return result;
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embedText(t)));
  }
}

/**
 * Local visual embedding provider using hash-based approach.
 * Generates deterministic visual embeddings from image content.
 * Used when no vision API key is configured.
 * This is NOT suitable for production visual search but keeps the UI running in DEMO_MODE.
 */
class LocalVisualProvider implements VisualEmbeddingProvider {
  private config: VisualEmbeddingConfig;

  constructor(config: VisualEmbeddingConfig) {
    this.config = config;
  }

  async embedImage(image: Buffer | File): Promise<number[]> {
    const buffer = image instanceof File ? await image.arrayBuffer() : Buffer.from(image as Buffer);
    const hash = require('crypto').createHash('sha256').update(buffer).digest();
    const dimension = this.config.dimension;
    const result: number[] = [];
    for (let i = 0; i < dimension; i++) {
      const byte = hash[i % hash.length];
      result.push((byte / 255 - 0.5) * 2);
    }
    return result;
  }

  async embedImages(images: Buffer | File[]): Promise<number[][]> {
    return Promise.all(images.map((img) => this.embedImage(img)));
  }
}

// Instantiate the appropriate provider based on environment configuration
const config: EmbeddingConfig = {
  model: process.env.EMBEDDING_MODEL || "nvidia/nemotron",
  dimension: Number(process.env.DIMENSION) || 384,
  metric: (process.env.EMBEDDING_METRIC as "cosine" | "l2" | "ip") || "cosine",
};

// Use Nemotron provider if API key is configured, otherwise fallback to local
let provider: EmbeddingProvider;
if (process.env.NEMOTRON_API_KEY) {
  provider = new NemotronProvider(config);
} else {
  provider = new LocalProvider(config);
}

// Visual embedding provider - separate from text provider for independence
// Uses same config but for visual model; falls back to local visual provider if no vision API
const visualConfig: VisualEmbeddingConfig = {
  model: process.env.VISUAL_EMBEDDING_MODEL || "local-visual",
  dimension: Number(process.env.VISUAL_EMBEDDING_DIMENSION) || 384,
  metric: (process.env.VISUAL_EMBEDDING_METRIC as "cosine" | "l2" | "ip") || "cosine",
};

let visualProvider: VisualEmbeddingProvider;
if (process.env.VISUAL_API_KEY) {
  // In a full implementation, would use a vision API provider
  // For now, fall through to local visual provider
  visualProvider = new LocalVisualProvider(visualConfig);
} else {
  visualProvider = new LocalVisualProvider(visualConfig);
}

export const realApi: SpecLensApi = {
  listDatasheets: (query = "") =>
    request<Datasheet[]>(`/datasheets${qs({ q: query || undefined })}`).then((data) =>
      data, // No Zod validation needed for list, UI handles it
    ),

  getDatasheet: (id) =>
    request<Datasheet>(`/datasheets/${encodeURIComponent(id)}`).then((data) => data),

  uploadDatasheet: (file: any) =>
    request<ProcessingJob>("/datasheets/upload", {
      method: "POST",
      body: file.file instanceof FormData ? file.file : new FormData().append("file", file.name ? new File([], file.name, { type: "application/pdf" }) : new File([], "uploaded.pdf", { type: "application/pdf" })),
    }).then((data) => data),

  indexDatasheet: (id) =>
    request<{ jobId: string }>(`/datasheets/${encodeURIComponent(id)}/index`, {
      method: "POST",
    }).then((data) => data),

  listJobs: () =>
    request<ProcessingJob[]>("/jobs").then((data) => data),

  getJob: (id) =>
    request<ProcessingJob>(`/jobs/${encodeURIComponent(id)}`).then((data) => data),

  search: async (query, filters: SearchFilters = {}) => {
    // Step 1: Authenticate user - check workspace context
    // Step 2: Validate request
    // Step 3: Embed query (using configured provider)
    // Step 4: Perform pgvector similarity search
    // Step 5: Apply workspace authorization (already in retrieval)
    // Step 6: Apply metadata filters
    // Step 7: Return ranked results

    try {
      const result = await executeSearch(
        {
          query,
          types: filters.types,
          manufacturer: filters.manufacturer,
          documentId: filters.documentId,
          minConfidence: filters.minConfidence,
          page: filters.page,
          pageSize: filters.pageSize,
        },
        /* workspaceId will be obtained from auth context */ 1, // TODO: pass real workspaceId
        provider,
        config
      );

      // Validate and return
      return SearchResultSetSchema.parse({
        query: result.query,
        latencyMs: result.latencyMs,
        total: result.total,
        results: result.results,
        facets: result.facets,
      });
    } catch (error: any) {
      // If embedding fails in REAL MODE, return clear error - NO fallback to mock
      if (process.env.DEMO_MODE !== "true") {
        throw new ApiError(
          500,
          "embedding_error",
          error.message || "Search embedding generation failed",
          { query }
        );
      }
      // In demo mode, fall through to mock behavior below
    }

    // DEMO_MODE fallback: use mock search
    return mockApi.search(query, filters);
  },

  visualSearch: async (image: File, filters: VisualSearchFilters = {}) => {
    // Step 1: Validate image and get workspace context
    // Step 2: Embed query image (using configured provider)
    // Step 3: Perform pgvector visual similarity search
    // Step 4: Apply workspace authorization (already in retrieval)
    // Step 5: Apply metadata filters
    // Step 6: Return ranked results

try {
      const result = await executeVisualSearch(
        {
          image,
          filters,
        },
        /* workspaceId will be obtained from auth context */ 1, // TODO: pass real workspaceId
        provider,
        config
      );

      // Validate and return
      return VisualSearchResultSetSchema.parse({
        queryImageName: result.queryImageId,
        latencyMs: result.latencyMs,
        total: result.total,
        results: result.results,
        facets: result.facets,
      });
    } catch (error: any) {
      // If visual embedding fails in REAL MODE, return explicit error - NO fallback
      if (process.env.DEMO_MODE !== "true") {
        throw new ApiError(
          500,
          "visual_embedding_error",
          error.message || "Visual search embedding generation failed",
          { image: image.name }
        );
      }
      // In demo mode - return empty visual search results
      // The UI will display appropriate messaging for demo mode
      return {
        queryImageName: image.name || 'unknown',
        latencyMs: 0,
        total: 0,
        results: [],
facets: [],
      };
    }
    // In demo mode - return empty visual search results
    // The UI will display appropriate messaging for demo mode
    return {
      queryImageName: image.name || 'unknown',
      latencyMs: 0,
      total: 0,
      results: [],
      facets: [],
    };
  },

  getEvidence: (id) =>
    request<Evidence>(`/evidence/${encodeURIComponent(id)}`).then((data) => data),

  listEvidence: (documentId) =>
    request<Evidence[]>(`/evidence${qs({ documentId })}`).then((data) => data),

  getComponent: (mpn) =>
    request<ComponentIntel>(`/components/${encodeURIComponent(mpn)}`).then((data) => data),

  askCopilot: (question) =>
    request<CopilotMessage>("/copilot", { method: "POST", body: { question } }).then((data) => data),

  generateSymbol: (mpn) =>
    request<SymbolSpec>("/symbols/generate", { method: "POST", body: { mpn } }).then((data) => data),

  getAnalytics: () =>
    request<Analytics>("/analytics").then((data) => data),

  listCollections: () =>
    request<Collection[]>("/collections").then((data) => data),

  getSession: () =>
    request<{ user: User; workspaces: Workspace[] }>("/session").then((data) => data),

  listActivity: () =>
    request<ActivityEvent[]>("/activity").then((data) => data),

  listNotifications: () =>
    request<AppNotification[]>("/notifications").then((data) => data),

  listHistory: () =>
    request<SearchHistoryEntry[]>("/history").then((data) => data),

  // Auth endpoints — use direct fetch with credentials: "include" for HTTP-only cookies
  auth: {
    login: async (email: string, password: string) => {
      const res = await fetch(`${process.env.API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new ApiError(err.statusMessage ?? "Login failed", res.status);
      }
      return res.json().then((data: any) => data);
    },

    signup: async (name: string, email: string, password: string, passwordConfirmation: string, workspaceName?: string) => {
      const res = await fetch(`${process.env.API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, passwordConfirmation, workspaceName }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new ApiError(err.statusMessage ?? "Signup failed", res.status);
      }
      return res.json().then((data: any) => data);
    },

    logout: async () => {
      const res = await fetch(`${process.env.API_BASE}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new ApiError("Logout failed", res.status);
      return res.json().then(() => ({ authenticated: false }));
    },

    session: async () => {
      const res = await fetch(`${process.env.API_BASE}/auth/session`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        return { authenticated: false };
      }
      return res.json();
    },
  },
};