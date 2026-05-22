export type FailureCategory =
  | "broken_locator"
  | "timeout_waiting_for_element"
  | "ambiguous_locator"
  | "element_not_visible"
  | "non_selector_failure";

export type PlaywrightAction =
  | "click"
  | "fill"
  | "expect"
  | "hover"
  | "selectOption"
  | "unknown";

export type NormalizedFailure = {
  testTitle: string;
  testFile: string;
  line?: number;
  column?: number;
  projectName?: string;
  retry?: number;
  status?: string;
  errorMessage: string;
  errorStack?: string;
  failedSelector?: string;
  action?: PlaywrightAction;
  tracePath?: string;
  pageUrl?: string;
  attachments?: Array<{
    name: string;
    contentType?: string;
    path?: string;
  }>;
};

export type CandidateLocator = {
  locator: string;
  strategy: "role" | "label" | "testId" | "text" | "css" | "unknown";
  source: "deterministic" | "cache" | "llm";
  evidence: string[];
};

export type RankedLocator = CandidateLocator & {
  confidence: number;
  reasons: string[];
};

export type HealingSuggestion = {
  failure: NormalizedFailure;
  category: FailureCategory;
  candidates: RankedLocator[];
  recommended?: RankedLocator;
};

export type HelixConfig = {
  testIdAttribute: string;
  minSuggestionConfidence: number;
  minAutoPatchConfidence: number;
  allowLLM: boolean;
  preferredLocators: Array<"role" | "label" | "testId" | "text">;
  excludePaths: string[];
};

export type AnalyzeInput = {
  failures: NormalizedFailure[];
  config: HelixConfig;
};

export type AnalyzeResult = {
  suggestions: HealingSuggestion[];
  unsupported: NormalizedFailure[];
};
