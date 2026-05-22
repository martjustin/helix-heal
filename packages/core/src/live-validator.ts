import type { AnalyzeResult, CandidateLocator, CandidateValidation, HelixConfig } from "./types.js";
import { rankCandidates } from "./ranker.js";

type LocatorLike = {
  count(): Promise<number>;
  isVisible(): Promise<boolean>;
  isEnabled(): Promise<boolean>;
};

export type LiveValidationPage = {
  getByRole(role: string, options: { name: string }): LocatorLike;
  getByTestId(testId: string): LocatorLike;
  getByText(text: string): LocatorLike;
  getByLabel(text: string): LocatorLike;
  getByPlaceholder(text: string): LocatorLike;
};

export async function applyLiveValidationWithPage(
  result: AnalyzeResult,
  config: HelixConfig,
  page: LiveValidationPage
): Promise<AnalyzeResult> {
  for (const suggestion of result.suggestions) {
    const candidates = [];

    for (const candidate of suggestion.candidates) {
      candidates.push({
        ...candidate,
        validation: await validateCandidateWithPage(candidate, page)
      });
    }

    suggestion.candidates = rankCandidates(candidates, config);
    suggestion.recommended = suggestion.candidates.find(
      (candidate) => candidate.confidence >= config.minSuggestionConfidence
    );
  }

  return result;
}

export async function validateCandidateWithPage(
  candidate: CandidateLocator,
  page: LiveValidationPage
): Promise<CandidateValidation> {
  const locator = resolveLocator(candidate.locator, page);
  if (!locator) {
    return {
      status: "unknown",
      mode: "live",
      reasons: ["live validation does not support this locator yet"]
    };
  }

  const matchCount = await locator.count();
  if (matchCount !== 1) {
    return {
      status: "failed",
      mode: "live",
      matchCount,
      reasons: [`live locator resolved to ${matchCount} element(s)`]
    };
  }

  const visible = await locator.isVisible();
  const enabled = await locator.isEnabled();

  if (!visible || !enabled) {
    return {
      status: "failed",
      mode: "live",
      matchCount,
      reasons: [`live locator unique but ${visible ? "visible" : "hidden"} and ${enabled ? "enabled" : "disabled"}`]
    };
  }

  return {
    status: "passed",
    mode: "live",
    matchCount,
    reasons: ["live locator resolves uniquely and is actionable"]
  };
}

function resolveLocator(locator: string, page: LiveValidationPage): LocatorLike | undefined {
  const role = parseRoleLocator(locator);
  if (role) {
    return page.getByRole(role.role, { name: role.name });
  }

  const testId = parseStringArg(locator, "getByTestId");
  if (testId) return page.getByTestId(testId);

  const text = parseStringArg(locator, "getByText");
  if (text) return page.getByText(text);

  const label = parseStringArg(locator, "getByLabel");
  if (label) return page.getByLabel(label);

  const placeholder = parseStringArg(locator, "getByPlaceholder");
  if (placeholder) return page.getByPlaceholder(placeholder);

  return undefined;
}

function parseRoleLocator(locator: string): { role: string; name: string } | undefined {
  const match = locator.match(/getByRole\("([^"]+)",\s*\{\s*name:\s*"([^"]+)"\s*\}\)/);
  return match ? { role: match[1], name: match[2] } : undefined;
}

function parseStringArg(locator: string, method: string): string | undefined {
  return locator.match(new RegExp(`${method}\\("([^"]+)"\\)`))?.[1];
}
