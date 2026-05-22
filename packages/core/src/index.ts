export { analyzeFailures } from "./analyze.js";
export { classifyFailure, isHealableCategory } from "./classifier.js";
export { defaultConfig, loadConfig } from "./config.js";
export { generateCandidates } from "./candidates.js";
export { rankCandidates } from "./ranker.js";
export { renderMarkdownReport, renderTextReport } from "./reporter.js";
export { validateCandidates } from "./validator.js";
export { generateDryRunPatches, renderPatchSet } from "./patch.js";
export type { PatchChange } from "./patch.js";
export type {
  AnalyzeInput,
  AnalyzeResult,
  AccessibilityNode,
  CandidateLocator,
  CandidateValidation,
  DomSnapshot,
  FailureCategory,
  HealingSuggestion,
  HelixConfig,
  NormalizedFailure,
  PlaywrightAction,
  RankedLocator,
  TraceAction,
  TraceContext
} from "./types.js";
