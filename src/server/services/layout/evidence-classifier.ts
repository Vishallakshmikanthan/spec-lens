/**
 * Evidence type classifier.
 * 
 * Classifies detected regions into the EvidenceType vocabulary by combining:
 * - Text signals (keywords, captions)
 * - Spatial signals (position, aspect ratio, size)
 * - Visual signals (detected via region detector)
 * 
 * Design: modular classification that can be extended with learned models.
 */

import type { BoundingBox, EvidenceType } from "@/types/speclens";
import type { DetectedRegion } from "@/server/services/layout/region-detector";

/**
 * Classification signal sources combined to determine the final EvidenceType.
 */
export interface ClassificationSignals {
  /** Keyword/text match confidence (0..1) */
  textConfidence: number;
  /** Spatial/layout match confidence (0..1) */
  spatialConfidence: number;
  /** Visual pattern match confidence (0..1) */
  visualConfidence: number;
  /** Detected evidence type hints */
  typeHints: EvidenceType[];
}

/**
 * Classify a detected region into an EvidenceType.
 * 
 * Combines multiple signal sources. The final type is chosen by weighted voting,
 * with clear provenance of which signals contributed.
 */
export class EvidenceClassifier {
  /**
   * Classify a single detected region.
   * 
   * @param region The detected region to classify
   * @returns The classified evidence type and reasoning
   */
  classifyRegion(region: DetectedRegion): { type: EvidenceType; reason: string; signals: ClassificationSignals } {
    const signals = this.analyzeSignals(region);

    // If there's a strong single signal, use it
    if (signals.textConfidence > 0.5 && signals.textConfidence >= signals.spatialConfidence &&
      signals.textConfidence >= signals.visualConfidence) {
      return {
        type: signals.typeHints[0] || "other",
        reason: `Text-dominant classification: ${signals.typeHints.filter(t => t !== "other").join(", ") || "other"}`,
        signals,
      };
    }

    if (signals.spatialConfidence > 0.5 && signals.spatialConfidence >= signals.textConfidence &&
      signals.spatialConfidence >= signals.visualConfidence) {
      return {
        type: signals.typeHints[0] || "other",
        reason: `Spatial-dominant classification: ${signals.typeHints.filter(t => t !== "other").join(", ") || "other"}`,
        signals,
      };
    }

    if (signals.visualConfidence > 0.5 && signals.visualConfidence >= signals.textConfidence &&
      signals.visualConfidence >= signals.spatialConfidence) {
      return {
        type: signals.typeHints[0] || "other",
        reason: `Visual-dominant classification: ${signals.typeHints.filter(t => t !== "other").join(", ") || "other"}`,
        signals,
      };
    }

    // Weighted voting: combine all signals
    const votedType = this.weightedVote(signals.typeHints, [
      signals.textConfidence,
      signals.spatialConfidence,
      signals.visualConfidence,
    ]);

    return {
      type: votedType,
      reason: `Weighted voting across ${signals.typeHints.length} signal sources`,
      signals,
    };
  }

  /**
   * Analyze all signal sources for a detected region.
   */
  private analyzeSignals(region: DetectedRegion): ClassificationSignals {
    const textConfidence = this.analyzeTextSignals(region);
    const spatialConfidence = this.analyzeSpatialSignals(region);
    const visualConfidence = this.analyzeVisualSignals(region);
    const typeHints = this.extractTypeHints(region);

    return { textConfidence, spatialConfidence, visualConfidence, typeHints };
  }

  /**
   * Analyze text-based signals (keywords, captions in the region's text).
   */
  private analyzeTextSignals(region: DetectedRegion): number {
    const lower = region.caption.toLowerCase();

    const typeKeywords: { [key: string]: EvidenceType } = {
      "pinout": ["pinout", "pin configuration", "terminal function", "pin list"],
      "package": ["package", "package outline", "mechanical drawing"],
      "block-diagram": ["block diagram", "functional block", "logic diagram"],
      "timing": ["timing diagram", "timing requirement", "timing chart", "waveform"],
      "application-circuit": ["application circuit", "typical application", "external circuit"],
      "electrical-curve": ["electrical curve", "frequency response", "bode"],
      "mechanical": ["mechanical drawing", "mechanical outline"],
      "table": ["table", "specification table"],
      "absolute-maximum": ["absolute maximum", "max. ratings", "max rating"],
      "functional-diagram": ["functional diagram", "functional block diagram"],
    };

    let matchCount = 0;
    let totalKeywords = 0;

    for (const [type, keywords] of Object.entries(typeKeywords)) {
      totalKeywords += keywords.length;
      for (const kw of keywords) {
        if (lower.includes(kw)) matchCount++;
      }
    }

    return totalKeywords > 0 ? Math.min(1.0, matchCount / totalKeywords) : 0.0;
  }

  /**
   * Analyze spatial/layout signals (position, aspect ratio, size relative to page).
   */
  private analyzeSpatialSignals(region: DetectedRegion): number {
    const bbox = region.bbox;
    const aspectRatio = bbox.w / Math.max(0.01, bbox.h);

    // Different types have characteristic aspect ratios
    let score = 0.0;

    // Pinouts are typically at top of page, moderate width
    if (bbox.y < 0.2 && aspectRatio > 0.5 && aspectRatio < 2.0) {
      score += 0.3;
    }

    // Block diagrams are typically wide
    if (aspectRatio > 1.5 && aspectRatio < 3.0) {
      score += 0.3;
    }

    // Timing diagrams are narrow and tall
    if (aspectRatio < 0.8) {
      score += 0.3;
    }

    // Application circuits are roughly square-rectangular
    if (aspectRatio >= 0.8 && aspectRatio <= 1.5) {
      score += 0.2;
    }

    return Math.min(1.0, score);
  }

  /**
   * Analyze visual signals (would need actual image analysis in full implementation).
   * For now, returns a moderate baseline since we lack image data at this layer.
   */
  private analyzeVisualSignals(region: DetectedRegion): number {
    // Baseline: without actual visual model output, return neutral signal
    // This would be augmented by a visual model in future phases
    return 0.2;
  }

  /**
   * Extract type hints from the region's caption and text.
   */
  private extractTypeHints(region: DetectedRegion): EvidenceType[] {
    const lower = region.caption.toLowerCase();
    const hints: EvidenceType[] = [];

    const hintMap: { [key: string]: EvidenceType[] } = {
      "pinout": ["pinout"],
      "package": ["package"],
      "block diagram": ["block-diagram"],
      "timing": ["timing"],
      "application circuit": ["application-circuit"],
      "electrical curve": ["electrical-curve"],
      "mechanical drawing": ["mechanical"],
      "table": ["table"],
      "absolute maximum": ["absolute-maximum"],
      "functional diagram": ["functional-diagram"],
    };

    for (const [keyword, types] of Object.entries(hintMap)) {
      if (lower.includes(keyword)) {
        hints.push(...types);
      }
    }

    // Always include "other" as a fallback if no hints matched
    if (hints.length === 0) hints.push("other");

    return hints;
  }

  /**
   * Weighted voting across type hints from different signal sources.
   */
  private weightedVote(
    typeHints: EvidenceType[],
    weights: number[], // [textWeight, spatialWeight, visualWeight]
  ): EvidenceType {
    // Count votes per type, weighted by source confidence
    const voteCounts: Map<EvidenceType, number> = new Map();

    for (const type of typeHints) {
      const current = voteCounts.get(type) || 0;
      voteCounts.set(type, current + weights[0]); // text weight
    }

    // Also add spatial and visual contributions for each hint
    for (let i = 0; i < typeHints.length; i++) {
      const weight = i === 0 ? weights[1] : weights[2]; // simplified
      for (const type of typeHints) {
        const current = voteCounts.get(type) || 0;
        voteCounts.set(type, current + weight);
      }
    }

    // Find the type with highest vote
    let bestType: EvidenceType = "other";
    let bestScore = -1;

    for (const [type, score] of voteCounts) {
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }

    return bestType;
  }
}