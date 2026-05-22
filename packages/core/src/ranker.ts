import type { CandidateLocator, HelixConfig, RankedLocator } from "./types.js";

export function rankCandidates(
  candidates: CandidateLocator[],
  config: HelixConfig
): RankedLocator[] {
  return candidates
    .map((candidate) => {
      const preferenceIndex = config.preferredLocators.indexOf(
        candidate.strategy as "role" | "label" | "testId" | "text"
      );
      const preferredBoost = preferenceIndex >= 0 ? 0.12 - preferenceIndex * 0.02 : 0;
      const strategyBase = candidate.strategy === "role" ? 0.78 : 0.66;
      const validationBoost = validationConfidenceAdjustment(candidate);
      const confidence = clamp(strategyBase + preferredBoost + validationBoost);

      return {
        ...candidate,
        confidence,
        reasons: [
          `${candidate.strategy} locator matches configured selector preference`,
          ...candidate.evidence,
          ...(candidate.validation?.reasons ?? [])
        ]
      };
    })
    .sort((a, b) => b.confidence - a.confidence);
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, Number(value.toFixed(2))));
}

function validationConfidenceAdjustment(candidate: CandidateLocator): number {
  if (candidate.validation?.status === "passed") {
    return candidate.validation.matchCount === 1 ? 0.05 : 0.02;
  }

  if (candidate.validation?.status === "failed") {
    return -0.3;
  }

  return 0;
}
