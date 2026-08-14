/**
 * Mock implementation of CopilotService backed by the demo evidence index.
 *
 * Satisfies the CopilotService contract with simulated latency. When the
 * real backend lands, the selection in src/services/index.ts flips to
 * NemotronCopilotService.
 */
import type { CopilotAnswer, SourceReference } from "@/types/speclens";
import { CopilotService } from "./types";
import { mockEvidence } from "@/mock/data";

const EVIDENCE_TYPE_LABEL: Record<string, string> = {
  pinout: "Pinout",
  package: "Package",
  "block-diagram": "Block Diagram",
  timing: "Timing",
  "application-circuit": "Application Circuit",
  "electrical-curve": "Electrical Curve",
  mechanical: "Mechanical Drawing",
  table: "Table",
  "absolute-maximum": "Absolute Maximum",
  "functional-diagram": "Functional Diagram",
  other: "Other",
};

export class MockCopilotService implements CopilotService {
  async ask(question: string): Promise<CopilotAnswer> {
    const related = mockEvidence
      .filter((e) =>
        question
          .toLowerCase()
          .split(/\s+/)
          .some((t) => t.length > 3 && (e.title + e.caption).toLowerCase().includes(t)),
      )
      .slice(0, 3);

    const sources: SourceReference[] = (related.length ? related : mockEvidence.slice(0, 2)).map(
      (e) => ({
        evidenceId: e.id,
        page: e.page,
        label: e.title,
        confidence: e.confidence,
      }),
    );

    const confidence = sources[0]?.confidence ?? 0.9;

    return {
      id: `m_${Math.random().toString(36).slice(2, 8)}`,
      role: "assistant",
      content:
        "This answer is generated from the demo evidence index. Once the retrieval backend is connected, the grounded answer for this question will be composed from the cited regions below, with per-claim citations.",
      sources,
      confidence,
    };
  }

  async getSuggestedQuestions(): Promise<string[]> {
    return [
      "What is the supply voltage range?",
      "Which pin is VCC?",
      "Show the typical application circuit.",
      "What package is this component available in?",
    ];
  }
}
