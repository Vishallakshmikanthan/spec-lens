/**
 * SpecLens frontend service layer.
 *
 * Every function here maps 1:1 to a planned backend endpoint. While
 * DEMO_MODE is true they resolve from the typed mock dataset with a small
 * simulated latency. Swapping to the real backend means replacing the body
 * of each function with a fetch to API_BASE — no UI change required.
 *
 *   POST /api/datasheets/upload      -> uploadDatasheet
 *   GET  /api/datasheets             -> listDatasheets
 *   GET  /api/datasheets/:id         -> getDatasheet
 *   POST /api/datasheets/:id/index   -> indexDatasheet
 *   GET  /api/jobs/:id               -> getJob
 *   POST /api/search                 -> search
 *   GET  /api/evidence/:id           -> getEvidence
 *   GET  /api/components/:mpn        -> getComponent
 *   POST /api/copilot                -> askCopilot
 *   POST /api/symbols/generate       -> generateSymbol
 *   GET  /api/analytics              -> getAnalytics
 */
import { DEMO_MODE } from "./config";
import {
  EVIDENCE_TYPE_LABEL,
  mockActivity,
  mockAnalytics,
  mockCollections,
  mockComponents,
  mockDatasheets,
  mockEvidence,
  mockHistory,
  mockJobs,
  mockNotifications,
  mockSymbolSpec,
  mockUser,
  mockWorkspaces,
} from "./mock-data";
import type {
  Analytics,
  Collection,
  ComponentIntel,
  CopilotMessage,
  Datasheet,
  Evidence,
  EvidenceType,
  ProcessingJob,
  SearchFilters,
  SearchResultSet,
  SymbolSpec,
} from "./types";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function assertDemo() {
  if (!DEMO_MODE) {
    throw new Error("SpecLens backend is not connected yet.");
  }
}

export const api = {
  async listDatasheets(query = ""): Promise<Datasheet[]> {
    assertDemo();
    await delay(140);
    const q = query.trim().toLowerCase();
    if (!q) return mockDatasheets;
    return mockDatasheets.filter((d) =>
      [d.mpn, d.manufacturer, d.title, d.fileName].join(" ").toLowerCase().includes(q),
    );
  },

  async getDatasheet(id: string): Promise<Datasheet | undefined> {
    assertDemo();
    await delay(80);
    return mockDatasheets.find((d) => d.id === id);
  },

  async uploadDatasheet(file: { name: string; size: number }): Promise<ProcessingJob> {
    assertDemo();
    await delay(220);
    return {
      id: `job_${Math.random().toString(36).slice(2, 8)}`,
      fileName: file.name,
      mpn: file.name.replace(/\.pdf$/i, "").toUpperCase(),
      status: "processing",
      progress: 0,
      pages: 0,
      sizeMb: Math.round((file.size / 1024 / 1024) * 10) / 10,
      startedAt: new Date().toISOString(),
      stages: [
        { key: "validate", label: "PDF validated", state: "pending" },
        { key: "load", label: "Document loaded", state: "pending" },
        { key: "render", label: "Pages rendered", state: "pending" },
        { key: "layout", label: "Layout analyzed", state: "pending" },
        { key: "regions", label: "Visual regions detected", state: "pending" },
        { key: "index", label: "Building retrieval index", state: "pending" },
        { key: "verify", label: "Evidence verification", state: "pending" },
        { key: "ready", label: "Ready", state: "pending" },
      ],
      logs: [],
    };
  },

  async indexDatasheet(id: string): Promise<{ jobId: string }> {
    assertDemo();
    await delay(120);
    return { jobId: `job_${id}` };
  },

  async listJobs(): Promise<ProcessingJob[]> {
    assertDemo();
    await delay(100);
    return mockJobs;
  },

  async getJob(id: string): Promise<ProcessingJob | undefined> {
    assertDemo();
    await delay(60);
    return mockJobs.find((j) => j.id === id);
  },

  async search(query: string, filters: SearchFilters = {}): Promise<SearchResultSet> {
    assertDemo();
    await delay(420);
    const q = query.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter((t) => t.length > 2);

    let results = mockEvidence.slice();

    if (tokens.length) {
      const scored = results
        .map((e) => {
          const haystack = [
            e.title,
            e.caption,
            e.mpn,
            e.manufacturer,
            EVIDENCE_TYPE_LABEL[e.type],
          ]
            .join(" ")
            .toLowerCase();
          const hits = tokens.filter((t) => haystack.includes(t)).length;
          return { e, hits };
        })
        .filter((s) => s.hits > 0);
      if (scored.length) {
        results = scored.sort((a, b) => b.hits - a.hits || b.e.confidence - a.e.confidence).map((s) => s.e);
      }
    }

    if (filters.types?.length) results = results.filter((e) => filters.types!.includes(e.type));
    if (filters.manufacturer) results = results.filter((e) => e.manufacturer === filters.manufacturer);
    if (filters.documentId) results = results.filter((e) => e.documentId === filters.documentId);
    if (filters.minConfidence)
      results = results.filter((e) => e.confidence >= filters.minConfidence!);
    if (filters.page) results = results.filter((e) => e.page === filters.page);

    results = results.sort((a, b) => b.retrievalScore - a.retrievalScore);

    const facetSource = filters.types?.length
      ? mockEvidence
      : results.length
        ? results
        : mockEvidence;
    const counts = new Map<EvidenceType, number>();
    for (const e of facetSource) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);

    return {
      query,
      latencyMs: 180 + Math.floor(Math.random() * 90),
      total: results.length,
      results,
      facets: [...counts.entries()].map(([type, count]) => ({ type, count })),
    };
  },

  async getEvidence(id: string): Promise<Evidence | undefined> {
    assertDemo();
    await delay(60);
    return mockEvidence.find((e) => e.id === id);
  },

  async listEvidence(): Promise<Evidence[]> {
    assertDemo();
    await delay(80);
    return mockEvidence;
  },

  async getComponent(mpn: string): Promise<ComponentIntel | undefined> {
    assertDemo();
    await delay(120);
    return mockComponents.find((c) => c.mpn.toLowerCase() === mpn.toLowerCase());
  },

  /**
   * The provider is intentionally abstract: a future backend (e.g. an
   * NVIDIA Nemotron deployment) returns { answer, sources, confidence }.
   */
  async askCopilot(question: string): Promise<CopilotMessage> {
    assertDemo();
    await delay(900);
    const related = mockEvidence
      .filter((e) =>
        question
          .toLowerCase()
          .split(/\s+/)
          .some((t) => t.length > 3 && (e.title + e.caption).toLowerCase().includes(t)),
      )
      .slice(0, 3);
    const sources = (related.length ? related : mockEvidence.slice(0, 2)).map((e) => ({
      evidenceId: e.id,
      page: e.page,
      label: e.title,
      confidence: e.confidence,
    }));
    return {
      id: `m_${Math.random().toString(36).slice(2, 8)}`,
      role: "assistant",
      content:
        "This answer is generated from the demo evidence index. Once the retrieval backend is connected, the grounded answer for this question will be composed from the cited regions below, with per-claim citations.",
      sources,
      confidence: sources[0]?.confidence ?? 0.9,
    };
  },

  async generateSymbol(mpn: string): Promise<SymbolSpec> {
    assertDemo();
    await delay(700);
    return { ...mockSymbolSpec, mpn: mpn || mockSymbolSpec.mpn };
  },

  async getAnalytics(): Promise<Analytics> {
    assertDemo();
    await delay(160);
    return mockAnalytics;
  },

  async listCollections(): Promise<Collection[]> {
    assertDemo();
    await delay(80);
    return mockCollections;
  },

  async getSession() {
    assertDemo();
    return { user: mockUser, workspaces: mockWorkspaces };
  },

  async listActivity() {
    assertDemo();
    return mockActivity;
  },

  async listNotifications() {
    assertDemo();
    return mockNotifications;
  },

  async listHistory() {
    assertDemo();
    return mockHistory;
  },
};

export type SpecLensApi = typeof api;
