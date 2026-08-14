/**
 * placeholder implementation for NVIDIA Nemotron backend.
 *
 * TODO: Replace with real Nemotron API call when the endpoint is available.
 * For now delegates to MockCopilotService so the UI works end-to-end without
 * a Nemotron deployment.
 */
import type { CopilotAnswer, SourceReference } from "@/types/speclens";
import { CopilotService } from "./types";

export class NemotronCopilotService implements CopilotService {
  async ask(question: string): Promise<CopilotAnswer> {
    // When Nemotron endpoint is available:
    // const response = await fetch("/api/copilot-nemotron", {
    //   method: "POST",
    //   body: JSON.stringify({ question }),
    // });
    // return response.json();

    // Fallback to mock so UI is functional without a real backend
    return new (await import("./mock-service")).MockCopilotService().ask(question);
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
