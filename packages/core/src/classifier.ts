import type { FailureCategory, NormalizedFailure } from "./types.js";

const locatorSignals = [
  "locator",
  "getByRole",
  "getByText",
  "getByLabel",
  "getByTestId",
  "waiting for",
  "strict mode violation",
  "resolved to"
];

export function classifyFailure(failure: NormalizedFailure): FailureCategory {
  const message = failure.errorMessage;
  const lower = message.toLowerCase();

  if (lower.includes("strict mode violation") || lower.includes("resolved to")) {
    return "ambiguous_locator";
  }

  if (lower.includes("not visible") || lower.includes("element is not visible")) {
    return "element_not_visible";
  }

  if (lower.includes("timeout") && hasLocatorSignal(message)) {
    return "timeout_waiting_for_element";
  }

  if (failure.failedSelector || hasLocatorSignal(message)) {
    return "broken_locator";
  }

  return "non_selector_failure";
}

export function isHealableCategory(category: FailureCategory): boolean {
  return (
    category === "broken_locator" ||
    category === "timeout_waiting_for_element" ||
    category === "ambiguous_locator" ||
    category === "element_not_visible"
  );
}

function hasLocatorSignal(message: string): boolean {
  return locatorSignals.some((signal) => message.includes(signal));
}

