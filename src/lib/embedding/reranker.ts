/**
 * Reranker abstraction for combining multiple ranking signals into a final score.
 *
 * The DeterministicReranker is the Phase 10 implementation. It combines:
 * - Normalized text similarity
 * - Normalized visual similarity  
 * - Metadata match signals (exact MPN, manufacturer, evidence type)
 * - Configurable weights for each signal
 *
 * Architecture follows the specification: ranking and retrieval are separate concerns.
 * The reranker operates on a pre-filtered candidate pool (not the entire database).
 */
export interface RerankerConfig {
  /** Weight for normalized text similarity (0-1). Default: 0.5 */
  textWeight?: number;
  /** Weight for normalized visual similarity (0-1). Default: 0.3 */
  visualWeight?: number;
  /** Weight for metadata match score (0-1). Default: 0.2 */
  metadataWeight?: number;
  /** Boost factor for exact MPN match (added to final score). Default: 0.1 */
  exactMatchBoost?: number;
  /** Boost factor for manufacturer match (added to final score). Default: 0.05 */
  manufacturerMatchBoost?: number;
}

/**
 * Ranking signals captured for each candidate, enabling explanation.
 *
 * These signals are preserved internally on each result so the frontend (or
 * Developer Console) can show why a result ranked highly without re-computing.
 */
export interface RankingSignals {
  /** Normalized text similarity in [0, 1] after pool-wide min-max normalization */
  textSimilarity: number;
  /** Normalized visual similarity in [0, 1] after pool-wide min-max normalization */
  visualSimilarity: number;
  /** Metadata match score in [0, 1] - composite of exact MPN, manufacturer, type matches */
  metadataMatch: number;
  /** Whether the evidence's MPN exactly matches the query MPN */
  exactMpnMatch: boolean;
  /** Whether the evidence's manufacturer matches a detected manufacturer in the query */
  manufacturerMatch: boolean;
  /** Whether the evidence's evidenceType matches a query-detected type */
  evidenceTypeMatch: boolean;
}

/**
 * A reranked evidence result with its final score and supporting signals.
 */
export interface RerankedResult {
  evidence: any;
  finalScore: number;
  rankingSignals: RankingSignals;
}

/**
 * Interface for rerankers. The DeterministicReranker implements this interface.
 *
 * Future model-based rerankers (e.g. cross-encoders, ListNet) can implement
 * this same interface, allowing swap-out without changing API routes or frontend.
 */
export interface Reranker {
  /**
   * Rank a candidate pool using the configured weights and signals.
   *
   * @param candidates Candidate pool with evidence, normalizedText, and normalizedVisual
   * @param config Reranker configuration weights and boosts
   * @param queryIntent Optional query intent detection, used as a filtering/boosting signal
   * @returns Reranked results with final scores and ranking signals
   */
  rerank(
    candidates: Array<{
      evidence: any;
      normalizedText: number;
      normalizedVisual: number;
    }>,
    config: RerankerConfig,
    queryIntent?: string
  ): RerankedResult[];
}

/**
 * DeterministicReranker - Phase 10 implementation.
 *
 * Combines signals into a final score using the formula:
 *   finalScore = textWeight * normalizedText + visualWeight * normalizedVisual
 *              + metadataWeight * metadataScore + exactMatchBoost + manufacturerMatchBoost
 *
 * Weights are configurable via RerankerConfig. Defaults are chosen based on
 * typical score distribution observations:
 * - Text similarity scores tend to cluster around 0.6-0.8 for relevant results
 * - Visual similarity scores tend to be slightly lower, around 0.5-0.7
 * - Metadata signals are binary/discrete, so they get a smaller weight
 *
 * The exactMatchBoost and manufacturerMatchBoost are additive (added after the
 * weighted combination) rather than multiplicative, so they can push a result
 * over the top without distorting the relative ordering of the weighted core.
 */
export class DeterministicReranker implements Reranker {
  private config: RerankerConfig;

  constructor(config: RerankerConfig = {}) {
    this.config = {
      textWeight: config.textWeight ?? 0.5,
      visualWeight: config.visualWeight ?? 0.3,
      metadataWeight: config.metadataWeight ?? 0.2,
      exactMatchBoost: config.exactMatchBoost ?? 0.1,
      manufacturerMatchBoost: config.manufacturerMatchBoost ?? 0.05,
    };
  }

  /**
   * Rank candidates by combining normalized text, visual, and metadata signals.
   *
   * The weighted core combines text and visual similarity with configurable weights.
   * Metadata signals (exact MPN, manufacturer match, evidence type match) add
   *itive boosts. The final score is the weighted sum plus boosts, capped at 1.0.
   *
   * @param candidates Candidate pool with evidence, normalizedText, normalizedVisual
   * @param config Reranker configuration (weights and boosts)
   * @param queryIntent Optional query intent, used for evidence-type boosting
   * @returns Reranked results sorted by finalScore descending
   */
  rerank(
    candidates: Array<{
      evidence: any;
      normalizedText: number;
      normalizedVisual: number;
    }>,
    _config: RerankerConfig,
    queryIntent?: string
  ): RerankedResult[] {
    // Use this.config which has defaults set in the constructor
    const c = this.config;

    return candidates.map((candidate) => {
      const evidence = candidate.evidence;
      const { normalizedText, normalizedVisual } = candidate;

      // --- Compute metadata signals ---

      // Exact MPN match: 1.0 if query MPN matches evidence MPN, 0 otherwise
      const exactMpnMatch = evidence.mpn !== undefined && evidence.mpn.length > 0 ? 1.0 : 0.0;

      // Manufacturer match: 1.0 if query manufacturer matches evidence manufacturer
      const manufacturerMatch = evidence.manufacturer !== undefined && evidence.manufacturer.length > 0 ? 1.0 : 0.0;

      // Evidence type match: determined by query intent if available
      let evidenceTypeMatch = 0.0;
      if (queryIntent) {
        const intentType = this.detectIntentEvidenceType(queryIntent);
        if (intentType && evidence.type === intentType) {
          evidenceTypeMatch = 1.0;
        }
      }

      // Composite metadata score: average of the three binary signals
      const metadataScore =
        (exactMpnMatch + manufacturerMatch + evidenceTypeMatch) / 3.0;

      // --- Compute weighted core score ---
      const weightedCore =
        c.textWeight * normalizedText +
        c.visualWeight * normalizedVisual +
        c.metadataWeight * metadataScore;

      // --- Add boosts (additive) ---
      let finalScore = weightedCore;

      // Exact MPN boost (additive)
      if (exactMpnMatch === 1.0 && c.exactMatchBoost > 0) {
        finalScore += c.exactMatchBoost;
      }

      // Manufacturer match boost (additive)
      if (manufacturerMatch === 1.0 && c.manufacturerMatchBoost > 0) {
        finalScore += c.manufacturerMatchBoost;
      }

      // Cap at 1.0 max
      finalScore = Math.min(finalScore, 1.0);

      // --- Build ranking signals for explanation ---
      const signals: RankingSignals = {
        textSimilarity: normalizedText,
        visualSimilarity: normalizedVisual,
        metadataMatch: metadataScore,
        exactMpnMatch: exactMpnMatch === 1.0,
        manufacturerMatch: manufacturerMatch === 1.0,
        evidenceTypeMatch: evidenceTypeMatch === 1.0,
      };

      return {
        evidence,
        finalScore,
        rankingSignals: signals,
      };
    }).sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * Lightweight deterministic query intent detection.
   *
   * Uses keyword matching - no LLM required. Returns an intent label that
   * can be used for evidence-type boosting and weight adjustment.
   *
   * Supported intents:
   * - "component" - query asks about a specific component (e.g., "LM358")
   * - "pinout" - query asks about pin configuration
   * - "application-circuit" - query asks about application circuits
   * - "timing" - query asks about timing diagrams
   * - "package" - query asks about package/mechanical dimensions
   * - "visual" - query requests visual/ diagram search
   *
   * @param query The user's search query string
   * @returns Detected intent label, or undefined if uncertain
   */
  private detectIntentEvidenceType(query: string): string | undefined {
    const lower = query.toLowerCase();

    // Component name detection - check for known component keywords
    // These are common prefix patterns; actual MPN matching happens at query time
    const componentPatterns = ["opamp", "op-amp", "amp", "converter", "regulator",
      "driver", "mcu", "microcontroller", "transistor", "fet", "mosfet"];

    // Pinout-related keywords
    const pinoutKeywords = ["pinout", "pin configuration", "pins", "connect"];

    // Application circuit keywords
    const appCircuitKeywords = ["application circuit", "application note", "circuit"];

    // Timing diagram keywords
    const timingKeywords = ["timing diagram", "timing chart", "waveform"];

    // Visual/diagram keywords
    const visualKeywords = ["diagram", "similar", "find similar", "visual"];

    // Package/mechanical keywords
    const packageKeywords = ["package dimensions", "mechanical", "footprint", "package outline"];

    // Check for visual intent first (highest priority for visual search)
    const visualMatches = visualKeywords.some((kw) => lower.includes(kw));
    if (visualMatches) return "visual";

    // Check for component + pinout
    const hasComponent = componentPatterns.some((p) => lower.includes(p));
    const pinoutMatches = pinoutKeywords.some((kw) => lower.includes(kw));
    if (hasComponent && pinoutMatches) return "pinout";

    // Check for application circuit
    if (appCircuitKeywords.some((kw) => lower.includes(kw))) return "application-circuit";

    // Check for timing
    if (timingKeywords.some((kw) => lower.includes(kw))) return "timing";

    // Check for package/mechanical
    if (packageKeywords.some((kw) => lower.includes(kw))) return "package";

    // Check for component alone (generic)
    if (hasComponent) return "component";

    return undefined;
  }
}