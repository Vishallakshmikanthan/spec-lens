/**
 * Mock implementation of SpecLensApi.
 *
 * Satisfies the full API contract from the typed dataset in src/mock/data.ts
 * with a small simulated latency, so every screen in the UI works in DEMO_MODE.
 * When the real backend lands, the selection in src/services/index.ts flips
 * to realApi and this module remains useful for tests, Storybook and the
 * Developer Console.
 */
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
} from "@/mock/data";
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
} from "@/types/speclens";
import type { SpecLensApi } from "./speclens-api";

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const mockApi: SpecLensApi = {
  async listDatasheets(query = ""): Promise<Datasheet[]> {
    await delay(140);
    const q = query.trim().toLowerCase();
    if (!q) return mockDatasheets;
    return mockDatasheets.filter((d) =>
      [d.mpn, d.manufacturer, d.title, d.fileName].join(" ").toLowerCase().includes(q),
    );
  },

  async getDatasheet(id: string): Promise<Datasheet | undefined> {
    await delay(80);
    return mockDatasheets.find((d) => d.id === id);
  },

  async uploadDatasheet(file: { name: string; size: number }): Promise<ProcessingJob> {
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
    await delay(120);
    return { jobId: `job_${id}` };
  },

  async listJobs(): Promise<ProcessingJob[]> {
    await delay(100);
    return mockJobs;
  },

  async getJob(id: string): Promise<ProcessingJob | undefined> {
    await delay(60);
    return mockJobs.find((j) => j.id === id);
  },

  async search(query: string, filters: SearchFilters = {}): Promise<SearchResultSet> {
    await delay(420);
    const q = query.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter((t) => t.length > 2);

    let results = mockEvidence.slice();

    if (tokens.length) {
      const scored = results
        .map((e) => {
          const haystack = [e.title, e.caption, e.mpn, e.manufacturer, EVIDENCE_TYPE_LABEL[e.type]]
            .join(" ")
            .toLowerCase();
          const hits = tokens.filter((t) => haystack.includes(t)).length;
          return { e, hits };
        })
        .filter((s) => s.hits > 0);
      if (scored.length) {
        results = scored
          .sort((a, b) => b.hits - a.hits || b.e.confidence - a.e.confidence)
          .map((s) => s.e);
      }
    }

    if (filters.types?.length) results = results.filter((e) => filters.types!.includes(e.type));
    if (filters.manufacturer)
      results = results.filter((e) => e.manufacturer === filters.manufacturer);
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
    await delay(60);
    return mockEvidence.find((e) => e.id === id);
  },

  async listEvidence(documentId?: string): Promise<Evidence[]> {
    await delay(80);
    return documentId ? mockEvidence.filter((e) => e.documentId === documentId) : mockEvidence;
  },

  async getComponent(mpn: string): Promise<ComponentIntel | undefined> {
    await delay(120);
    return mockComponents.find((c) => c.mpn.toLowerCase() === mpn.toLowerCase());
  },

  /**
   * The provider is intentionally abstract: a future backend (e.g. an
   * NVIDIA Nemotron deployment) returns { answer, sources, confidence }.
   */
  async askCopilot(question: string): Promise<CopilotMessage> {
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
    await delay(700);
    return { ...mockSymbolSpec, mpn: mpn || mockSymbolSpec.mpn };
  },

  async getAnalytics(): Promise<Analytics> {
    await delay(160);
    return mockAnalytics;
  },

  async listCollections(): Promise<Collection[]> {
    await delay(80);
    return mockCollections;
  },

  async getSession() {
    await delay(60);
    return { user: mockUser, workspaces: mockWorkspaces };
  },

  async listActivity() {
    await delay(60);
    return mockActivity;
  },

  async listNotifications() {
    await delay(60);
    return mockNotifications;
  },

  async listHistory() {
    await delay(60);
    return mockHistory;
  },
};
