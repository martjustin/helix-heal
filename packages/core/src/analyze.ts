import { classifyFailure, isHealableCategory } from "./classifier.js";
import { generateCandidates } from "./candidates.js";
import { rankCandidates } from "./ranker.js";
import { validateCandidates } from "./validator.js";
import type { AnalyzeInput, AnalyzeResult, HealingSuggestion, NormalizedFailure } from "./types.js";

export function analyzeFailures(input: AnalyzeInput): AnalyzeResult {
  const suggestions: HealingSuggestion[] = [];
  const unsupported: NormalizedFailure[] = [];

  for (const failure of input.failures) {
    const category = classifyFailure(failure);

    if (!isHealableCategory(category)) {
      unsupported.push(failure);
      continue;
    }

    const generatedCandidates = generateCandidates(failure, input.config);
    const candidates = rankCandidates(validateCandidates(generatedCandidates, failure), input.config);
    const recommended = candidates.find(
      (candidate) => candidate.confidence >= input.config.minSuggestionConfidence
    );

    suggestions.push({
      failure,
      category,
      candidates,
      recommended
    });
  }

  return { suggestions, unsupported };
}
