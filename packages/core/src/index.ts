export { analyzeFailures } from "./analyze.js";
export { classifyFailure, isHealableCategory } from "./classifier.js";
export { defaultConfig, loadConfig } from "./config.js";
export { generateCandidates } from "./candidates.js";
export { rankCandidates } from "./ranker.js";
export { renderMarkdownReport, renderTextReport } from "./reporter.js";
export { validateCandidates } from "./validator.js";
export { generateDryRunPatchReport, generateDryRunPatches, renderPatchSet } from "./patch.js";
export { applyLiveValidationWithPage, validateCandidateWithPage } from "./live-validator.js";
export {
  applyHealCache,
  readHealCache,
  updateHealCacheFromResult,
  writeHealCache
} from "./cache.js";
export { renderDashboardHtml } from "./dashboard.js";
export type { PatchChange, PatchDiagnostic, PatchReport } from "./patch.js";
export type { LiveValidationPage } from "./live-validator.js";
export type { HealCache, HealCacheEntry } from "./cache.js";
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
