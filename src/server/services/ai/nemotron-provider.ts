/**
 * Real NVIDIA Nemotron provider for SpecLens Copilot.
 *
 * Server-side only — reads the API key from NEMOTRON_API_KEY
 * environment variable. Never exposes the key to the browser.
 *
 * If the API key is missing, this provider throws a clear
 * configuration error rather than silently pretending Nemotron worked.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { AIProvider } from "./ai-provider";

const API_BASE_URL = "https://api.nVIDIA.com/v1/chat/completions";

import {
  buildNemotronUserPrompt,
  getNemotronSystemPrompt,
  parseNemotronResponse,
} from "@/lib/speclens/copilot-utils";

export class NemotronProvider implements AIProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env["NEMOTRON_API_KEY"] || "";
    if (!this.apiKey) {
      // We still store empty string; the ask() method will check and throw.
    }
  }

  async ask(
    question: string,
    evidenceContext: any,
    conversationHistory?: any[],
  ): Promise<{
    answer: string;
    sources: any[];
    caveats?: string[];
  }> {
    if (!this.apiKey) {
      throw new Error(
        "Nemotron API key not configured. Set NEMOTRON_API_KEY environment variable.",
      );
    }

    // Build the user prompt with evidence context
    const userPrompt = buildNemotronUserPrompt({
      question,
      evidenceContext,
      conversationHistory,
    });

    const response = await fetch(API_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "nemotron",
        messages: [
          { role: "system", content: getNemotronSystemPrompt() },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Nemotron API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;

    if (!message || !message.content) {
      throw new Error("Nemotron returned unexpected response format");
    }

    return parseNemotronResponse(message.content);
  }
}

/**
 * Factory function to create a NemotronProvider instance.
 * Reads the API key from process.env.NEMOTRON_API_KEY.
 */
/* eslint-enable @typescript-eslint/no-explicit-any */
export function createNemotronProvider(): NemotronProvider {
  return new NemotronProvider();
}
