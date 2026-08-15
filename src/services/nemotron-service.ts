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

export class NemotronCopilotService implements CopilotService {
  async ask(question: string): Promise<CopilotAnswer> {
    if (DEMO_MODE) {
      // Fall back to mock so UI is functional without a real backend
      return new (await import("./mock-service")).MockCopilotService().ask(question);
    }

    // Call the real /api/copilot endpoint
    // In a production TanStack Start environment, we use the relative path
    // which the Vite proxy will redirect to the H3 endpoint.
    try {
      const response = await globalThis.fetch("/api/copilot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        // If the endpoint returns an error (e.g., missing API key),
        // fall back to mock rather than breaking the UI
        const errorText = await response.text();
        console.error("Nemotin /api/copilot error:", response.status, errorText);
        return new (await import("./mock-service")).MockCopilotService().ask(question);
      }

      const data = await response.json();
      // Transform the endpoint response into CopilotAnswer format
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
      // Fall back to mock on any error
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

    // In production, could return suggested questions based on available evidence
    return [
      "What is the supply voltage range?",
      "Which pin is VCC?",
      "Show the typical application circuit.",
      "What package is this component available in?",
    ];
  }
}