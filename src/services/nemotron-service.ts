/**
 * Real implementation of CopilotService using the NVIDIA Nemotron backend.
 *
 * When DEMO_MODE is false, this service calls the real /api/copilot endpoint
 * which implements the full SpecLens grounding pipeline (retrieval, evidence
 * context building, Nemotron LLM, citation validation).
 *
 * When DEMO_MODE is true, falls back to MockCopilotService so the UI works
 * end-to-end without a Nemotron deployment.
 */
import { DEMO_MODE } from "@/lib/speclens/config";
import type { CopilotAnswer, CopilotService } from "@/types/speclens";
import { MockCopilotService } from "./mock-service";
import { createNemotronProvider } from "./ai/nemotron-provider";
import type { AIProvider } from "./ai/ai-provider";

export class NemotronCopilotService implements CopilotService {
  private aiProvider: AIProvider;

  constructor() {
    this.aiProvider = createNemotronProvider();
  }

  async ask(question: string): Promise<CopilotAnswer> {
    if (DEMO_MODE) {
      return new (await import("./mock-service")).MockCopilotService().ask(question);
    }

    try {
      const response = await globalThis.fetch("/api/copilot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Nemotin /api/copilot error:", response.status, errorText);
        return new (await import("./mock-service")).MockCopilotService().ask(question);
      }

      const data = await response.json();
      return {
        id: data.id || `m_${Math.random().toString(36).slice(2, 8)}`,
        role: "assistant",
        content: data.answer || "No answer generated.",
        sources: data.sources || [],
        confidence: data.confidence !== undefined ? data.confidence : 0.9,
        pending: false,
      };
    } catch (error) {
      console.error("NemotronCopilotService ask error:", error);
      return new (await import("./mock-service")).MockCopilotService().ask(question);
    }
  }

  async getSuggestedQuestions(): Promise<string[]> {
    if (DEMO_MODE) {
      return [
        "What is the supply voltage range?",
        "Which pin is VCC?",
        "Show the typical application circuit.",
        "What package is this component available in?",
      ];
    }

    return [
      "What is the supply voltage range?",
      "Which pin is VCC?",
      "Show the typical application circuit.",
      "What package is this component available in?",
    ];
  }
}
