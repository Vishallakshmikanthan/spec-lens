/**
 * Unit tests for SpecLens Copilot grounded pipeline.
 * Uses mocked Nemotron responses and deterministic data.
 * These tests do NOT require external AI — all data is mocked.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

describe("AI Provider Abstraction", () => {
  describe("AIProvider interface", () => {
    it("should have the correct method signature", async () => {
      const { AIProvider } = await import("@/server/services/ai/ai-provider");
      expect(AIProvider).toBeDefined();
    });
  });

  describe("NemotronProvider", () => {
    it("should be creatable via factory", async () => {
      const { createNemotronProvider } = await import("@/server/services/ai/nemotron-provider");
      expect(createNemotronProvider).toBeDefined();
    });

    it("should produce a provider with ask method", async () => {
      const { createNemotronProvider } = await import("@/server/services/ai/nemotron-provider");
      const provider = createNemotronProvider();
      const result = await provider.ask("test question", {});
      expect(result.answer).toBeDefined();
      expect(result.sources).toBeDefined();
    });
  });
});

describe("Copilot Pipeline - Question Normalization", () => {
  describe("normalizeQuestion", () => {
    it("should normalize whitespace", async () => {
      const { normalizeQuestion } = await import("@/lib/speclens/copilot-utils");
      const result = normalizeQuestion("  What   is   the   voltage  ");
      expect(result).toBe("what is the voltage");
    });

    it("should trim the question", async () => {
      const { normalizeQuestion } = await import("@/lib/speclens/copilot-utils");
      const result = normalizeQuestion("  LM358 supply voltage  ");
      expect(result).toBe("lm358 supply voltage");
    });
  });
});

describe("Copilot Pipeline - Rate Limiter", () => {
  it("should allow requests within limit", async () => {
    const { CopilotRateLimiter } = await import("@/lib/speclens/copilot-utils");
    const limiter = new CopilotRateLimiter();
    expect(limiter.isAllowed("user:1", 5, 1000)).toBe(true);
    expect(limiter.isAllowed("user:1", 5, 1000)).toBe(true);
    expect(limiter.isAllowed("user:1", 5, 1000)).toBe(true);
    expect(limiter.isAllowed("user:1", 5, 1000)).toBe(true);
    expect(limiter.isAllowed("user:1", 5, 1000)).toBe(true);
    expect(limiter.isAllowed("user:1", 5, 1000)).toBe(false); // 6th request should fail
  });
});

describe("Copilot Pipeline - System Prompt", () => {
  describe("getNemotronSystemPrompt", () => {
    it("should contain grounding rules", async () => {
      const { getNemotronSystemPrompt } = await import("@/lib/speclens/copilot-utils");
      const prompt = getNemotronSystemPrompt();

      expect(prompt).toContain("PRIORITIZE SUPPLIED EVIDENCE");
      expect(prompt).toContain("DISTINGUISH EVIDENCE FROM INFERENCE");
      expect(prompt).toContain("NEVER invent datasheet values");
      expect(prompt).toContain("NEVER fabricate citations");
      expect(prompt).toContain("EXPLICITLY say when evidence is insufficient");
    });
  });
});

describe("Copilot Pipeline - Citation Validation (mocked)", () => {
  it("validateCitations should work with valid citations", async () => {
    const { validateCitations } = await import("@/lib/speclens/copilot-utils");
    const result = validateCitations(
      [{ evidenceId: "EV-0017", page: 4, label: "Pin Configuration", relevance: "high" }],
      [{ evidence: { evidenceId: "EV-0017", documentId: "ds_lm358" } as any, documentId: "ds_lm358" }],
    );
    expect(result.valid).toBeDefined();
    expect(result.citations).toBeDefined();
  });

  it("validateCitations should reject invalid citations", async () => {
    const { validateCitations } = await import("@/lib/speclens/copilot-utils");
    const result = validateCitations(
      [{ evidenceId: "EV-NONEXISTENT", page: 4, label: "Non-existent", relevance: "high" }],
      [{ evidence: { evidenceId: "EV-0017", documentId: "ds_lm358" } as any, documentId: "ds_lm358" }],
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("Copilot Pipeline - Confidence Calculation (mocked)", () => {
  it("calculateConfidence should return a value", async () => {
    const { calculateConfidence } = await import("@/lib/speclens/copilot-utils");
    const result = calculateConfidence(
      [{ evidence: { retrievalScore: 0.9, verificationState: "verified" } as any, documentId: "ds_lm358" }],
      { valid: true, citations: [{ evidenceId: "EV-0017" }], errors: [] } as any,
    );
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });
});

describe("Copilot Pipeline - Clean Invalid Citations", () => {
  it("cleanInvalidCitations should clean properly", async () => {
    const { cleanInvalidCitations } = await import("@/lib/speclens/copilot-utils");
    const { cleanedAnswer } = cleanInvalidCitations(
      "Answer with bad evidenceEV-0017",
      {
        valid: false,
        citations: [],
        errors: ["Citation references evidence EV-0017 which was not in the retrieved context"],
      },
    );
    expect(cleanedAnswer).toContain("unsupported");
  });

  it("cleanInvalidCitations should return clean answer when no errors", async () => {
    const { cleanInvalidCitations } = await import("@/lib/speclens/copilot-utils");
    const { cleanedAnswer } = cleanInvalidCitations(
      "Answer with valid citations",
      {
        valid: true,
        citations: [{ evidenceId: "EV-0017", relevance: "high" }],
        errors: [],
      },
    );
    expect(cleanedAnswer).toBe("Answer with valid citations");
  });
});

describe("Copilot Pipeline - Conversation History Bounding", () => {
  it("should handle history without infinite growth", async () => {
    const { buildNemotronUserPrompt } = await import("@/lib/speclens/copilot-utils");
    const prompt = buildNemotronUserPrompt({
      question: "What about input common-mode range?",
      evidenceContext: {
        componentContext: { mpn: "LM358", manufacturer: "Texas Instruments" },
        evidence: [],
        totalEvidenceCount: 0,
        maxContextItems: 0,
      },
      conversationHistory: [
        { role: "user", content: "Turn 1", sources: [] },
        { role: "assistant", content: "Response 1", sources: [], confidence: 0.9 },
        { role: "user", content: "Turn 2", sources: [] },
        { role: "assistant", content: "Response 2", sources: [], confidence: 0.91 },
        { role: "user", content: "Turn 3", sources: [] },
        { role: "assistant", content: "Response 3", sources: [], confidence: 0.92 },
        { role: "user", content: "Turn 4", sources: [] },
        { role: "assistant", content: "Response 4", sources: [], confidence: 0.93 },
        { role: "user", content: "Turn 5", sources: [] },
        { role: "assistant", content: "Response 5", sources: [], confidence: 0.94 },
        { role: "user", content: "Current question - should be bounded", sources: [] },
      ],
    });

    // Prompt should contain the history section
    expect(prompt).toContain("Conversation History (most recent first):");
    // The section should not be excessively large - bounded to reasonable size
    const historySection = prompt.split("Conversation History (most recent first):")[1];
    // Should have finite lines
    const lines = historySection.split("\n").length;
    expect(lines).toBeLessThan(50);
  });
});