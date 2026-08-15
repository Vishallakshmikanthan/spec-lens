/**
 * Score normalization strategies for combining text and visual similarity scores.
 *
 * Text and visual similarity scores may have different distributions depending on
 * the embedding model, dataset characteristics, and query types. Normalizing them
 * to a common [0, 1] range enables meaningful weighted combination.
 *
 * Normalization method: min-max scaling per candidate pool.
 * Input range: [minObserved, maxObserved] from the candidate pool
 * Output range: [0, 1]
 *
 * If max === min (all scores identical), returns 0.5 (neutral) to avoid division
 * by zero and indicate "no differentiation."
 */
export function normalizeScore(
  score: number,
  inputMin: number,
  inputMax: number
): number {
  if (inputMax === inputMin) return 0.5;
  return (score - inputMin) / (inputMax - inputMin);
}

/**
 * Normalizes text and visual scores across a candidate pool.
 *
 * For each candidate that has a textScore or visualScore, the raw score is
 * normalized relative to the min/max observed across all candidates with that
 * score type. Candidates missing a score type receive a neutral 0.5.
 *
 * The returned NormalizedScores object can be passed to the reranker along
 * with the candidate evidence, allowing the reranker to use the normalized
 * scores in its weighted formula.
 */
export interface NormalizedScores {
  /** Normalized text similarity in [0, 1], relative to candidate pool */
  normalizedText: number;
  /** Normalized visual similarity in [0, 1], relative to candidate pool */
  normalizedVisual: number;
  /** Min text score observed in the candidate pool (for reference) */
  textMin: number;
  /** Max text score observed in the candidate pool (for reference) */
  textMax: number;
  /** Min visual score observed in the candidate pool (for reference) */
  visualMin: number;
  /** Max visual score observed in the candidate pool (for reference) */
  visualMax: number;
}

/**
 * Normalize scores for a candidate pool and attach them to each candidate.
 *
 * For each candidate in the pool:
 * - If the candidate has a textScore, normalize it against the pool's text min/max
 * - If the candidate has a visualScore, normalize it against the pool's visual min/max
 * - If a score type is absent for a candidate, assign 0.5 (neutral)
 *
 * This is a per-pool normalization: the min/max are computed from all candidates
 * in the pool, not globally. This means the same raw score can normalize differently
 * depending on the candidate pool's score distribution.
 *
 * @param candidates Candidate pool, each may have textScore and/or visualScore
 * @returns Pool with normalized scores attached, and the observed min/max ranges
 */
export function normalizeCandidatePool(
  candidates: Array<{
    evidence: any;
    textScore?: number;
    visualScore?: number;
  }>
): {
  candidates: Array<{
    evidence: any;
    normalizedText: number;
    normalizedVisual: number;
  }>;
  normalized: NormalizedScores;
} {
  // Collect all observed text and visual scores from the pool
  const textScores = candidates
    .filter((c) => c.textScore !== undefined)
    .map((c) => c.textScore!);
  const visualScores = candidates
    .filter((c) => c.visualScore !== undefined)
    .map((c) => c.visualScore!);

  const textMin = textScores.length > 0 ? Math.min(...textScores) : 0;
  const textMax = textScores.length > 0 ? Math.max(...textScores) : 1;
  const visualMin = visualScores.length > 0 ? Math.min(...visualScores) : 0;
  const visualMax = visualScores.length > 0 ? Math.max(...visualScores) : 1;

  const normalizedCandidates = candidates.map((candidate) => ({
    evidence: candidate.evidence,
    normalizedText:
      candidate.textScore !== undefined
        ? normalizeScore(candidate.textScore, textMin, textMax)
        : 0.5,
    normalizedVisual:
      candidate.visualScore !== undefined
        ? normalizeScore(candidate.visualScore, visualMin, visualMax)
        : 0.5,
  }));

  const normalized: NormalizedScores = {
    normalizedText: 0.5,
    normalizedVisual: 0.5,
    textMin,
    textMax,
    visualMin,
    visualMax,
  };

  // Set the normalized values in the NormalizedScores object for convenience
  // (the per-candidate values are in the normalizedCandidates array)
  normalized.normalizedText = normalizedCandidates[0]?.normalizedText ?? 0.5;
  normalized.normalizedVisual = normalizedCandidates[0]?.normalizedVisual ?? 0.5;

  return { candidates: normalizedCandidates, normalized };
}