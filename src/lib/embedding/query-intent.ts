/**
 * Deterministic query intent detection.
 *
 * Uses keyword pattern matching - no LLM required. The detector is intentionally
 * simple and rule-based, allowing it to run quickly and predictably. The intent
 * label is used as a ranking/filtering signal in the hybrid retriever and
 * deterministic reranker.
 *
 * Supported intents (in priority order, first match wins):
 * - "visual" - user wants visually similar diagrams/images
 * - "pinout" - user wants component pinout/configuration information
 * - "application-circuit" - user wants application circuit diagrams
 * - "timing" - user wants timing diagrams or timing-related evidence
 * - "package" - user wants package dimensions or mechanical drawings
 * - "component" - user is asking about a specific component (generic)
 *
 * Detection order matters: "visual" is checked first because if a user says
 * "show me diagrams similar to this", we want visual search even if component
 * keywords are also present.
 *
 * DO NOT reject results solely because intent detection is uncertain - the
 * intent is used only as a ranking/filtering signal, not a gate.
 */
export type QueryIntent =
  | "visual"
  | "pinout"
  | "application-circuit"
  | "timing"
  | "package"
  | "component";

/**
 * Detection result from intent analysis.
 */
export interface IntentResult {
  /** The detected intent label, or undefined if uncertain */
  intent?: QueryIntent;
  /** Raw query text for reference */
  query: string;
  /** Whether the intent was confidently detected */
  confident: boolean;
}

/**
 * Detect the intent of a user's search query.
 *
 * This is a deterministic, rule-based detector. It does NOT use an LLM.
 * It is used as a ranking and filtering signal in the hybrid retrieval pipeline,
 * not as a gate to reject results.
 *
 * Detection heuristics (checked in priority order):
 * 1. "visual" - keywords: diagram, similar, visual, show me this
 * 2. "pinout" - component name + pin/ configuration keywords
 * 3. "application-circuit" - application circuit / circuit keywords
 * 4. "timing" - timing diagram / waveform / timing-related keywords
 * 5. "package" - package dimensions / mechanical / footprint keywords
 * 6. "component" - generic component name detection
 *
 * @param query The user's search query string
 * @returns Intent result containing the detected intent and confidence
 */
export function detectIntent(query: string): IntentResult {
  const lower = query.toLowerCase().trim();

  // --- Visual intent (highest priority) ---
  // Keywords that strongly indicate the user wants visual/ diagram search
  const visualKeywords = [
    "diagram",
    "similar",
    "show me.*diagram",
    "find.*diagram",
    "visual",
    "image",
    "picture",
    " screenshot",
  ];

  const visualPattern = visualKeywords.some((kw) => {
    // Handle regex-like patterns with .*
    if (kw.includes(".*")) {
      const base = kw.replace(".*", "");
      return lower.includes(base);
    }
    return lower.includes(kw);
  });

  if (visualPattern) {
    return {
      intent: "visual",
      query,
      confident: true,
    };
  }

  // --- Pinout intent ---
  // Component name + pin/ configuration keywords
  const pinoutComponentKeywords = [
    "pinout",
    "pin configuration",
    "pins",
    "pinout of",
  ];

  const pinoutPattern = pinoutComponentKeywords.some((kw) => lower.includes(kw));

  // Also check if there's a component name mentioned (common patterns:
  // "LM358 pinout", "pin configuration of LM358")
  const commonComponentPrefixes = /(lm\d{2,3}|2n\d{3}|uc\d{3}|ca\d{3})/i;
  hasComponentMatch = commonComponentPrefixes.test(lower);

  if (pinoutPattern || hasComponentMatch) {
    return {
      intent: "pinout",
      query,
      confident: true,
    };
  }

  // --- Application-circuit intent ---
  const appCircuitKeywords = [
    "application circuit",
    "application note",
    "circuit diagram",
  ];

  const appCircuitPattern = appCircuitKeywords.some((kw) => lower.includes(kw));

  if (appCircuitPattern) {
    return {
      intent: "application-circuit",
      query,
      confident: true,
    };
  }

  // --- Timing intent ---
  const timingKeywords = [
    "timing diagram",
    "timing chart",
    "waveform",
    "timing analysis",
  ];

  const timingPattern = timingKeywords.some((kw) => lower.includes(kw));

  if (timingPattern) {
    return {
      intent: "timing",
      query,
      confident: true,
    };
  }

  // --- Package / mechanical intent ---
  const packageKeywords = [
    "package dimensions",
    "mechanical",
    "footprint",
    "package outline",
    "housing",
  ];

  const packagePattern = packageKeywords.some((kw) => lower.includes(kw));

  if (packagePattern) {
    return {
      intent: "package",
      query,
      confident: true,
    };
  }

  // --- Component intent (fallback) ---
  // Generic component name detection - looks for common component identifiers
  const componentPatterns = [
    /(lm\d{2,3})/i,        // LM358, LM324, etc.
    /(2n\d{3})/i,          // 2N2222, etc.
    /(uc\d{3})/i,          // UC3845, etc.
    /(ca\d{3})/i,          // CA3140, etc.
    /(opamp|op-amp)/i,     // generic op-amp
    /(converter|regulator)/i,
    /(driver)/i,
  ];

  const componentMatch = componentPatterns.some((pat) => pat.test(lower));

  if (componentMatch) {
    return {
      intent: "component",
      query,
      confident: true,
    };
  }

  // --- Uncertain ---
  return {
    intent: undefined,
    query,
    confident: false,
  };
}

/**
 * Get the evidence type associated with a query intent.
 *
 * Maps the detected QueryIntent to the corresponding EvidenceType enum value
 * used in the SpecLens database schema. This is used for evidence-type boosting
 * in the hybrid retriever and deterministic reranker.
 *
 * @param intent The detected query intent
 * @returns The corresponding EvidenceType, or undefined if no mapping
 */
export function intentToEvidenceType(intent: QueryIntent): string | undefined {
  const mapping: Record<QueryIntent, string> = {
    visual: "other",         // visual queries default to "other" or could be omitted
    pinout: "pinout",
    "application-circuit": "application-circuit",
    timing: "timing",
    package: "mechanical",
    component: "other",      // generic component - no specific type boost
  };

  return mapping[intent];
}

/**
 * Boost factor applied to matching evidence types based on query intent.
 *
 * When a query intent strongly suggests an evidence type, matching evidence
 * types receive a meaningful boost in ranking. The boost is applied by the
 * hybrid retriever and deterministic reranker.
 *
 * Non-matching evidence types are NOT eliminated - the boost simply preference
 * matching types. The user can still see and filter other types if desired.
 *
 * @param intent The detected query intent
 * @returns Boost factor in [0, 1], or 0 if intent doesn't suggest a type boost
 */
export function getIntentBoostFactor(intent: QueryIntent): number {
  const boosts: Record<QueryIntent, number> = {
    visual: 0.0,        // visual intent doesn't boost a specific type
    pinout: 0.2,        // pinout evidence gets 20% boost
    "application-circuit": 0.15,  // application-circuit gets 15% boost
    timing: 0.1,        // timing evidence gets 10% boost
    package: 0.1,       // mechanical/package gets 10% boost
    component: 0.05,    // generic component gets small boost
  };

  return boosts[intent] ?? 0.0;
}