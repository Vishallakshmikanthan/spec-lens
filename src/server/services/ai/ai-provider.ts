/**
 * AI Provider abstraction for SpecLens Copilot.
 *
 * Defines the contract for grounded AI answer generation.
 * Implementations must be server-side only — the Nemotron API key
 * must never be sent to the browser.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AIProvider {
  /**
   * Generate a grounded answer using the supplied evidence context.
   * Returns a structured response with answer, sources, and caveats.
   * Throws if the provider is not configured (e.g. missing API key).
   *
   * @param question - The user's question
   * @param evidenceContext - Retrieved SpecLens evidence context
   * @param conversationHistory - Previous conversation turns
   */
  ask(
    question: string,
    evidenceContext: any,
    conversationHistory?: any[],
  ): Promise<{
    answer: string;
    sources: any[];
    caveats?: string[];
  }>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
