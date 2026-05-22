import type { CandidateLocator, CandidateValidation, NormalizedFailure } from "./types.js";

export function validateCandidates(
  candidates: CandidateLocator[],
  failure: NormalizedFailure
): CandidateLocator[] {
  return candidates.map((candidate) => ({
    ...candidate,
    validation: validateCandidate(candidate, failure)
  }));
}

function validateCandidate(
  candidate: CandidateLocator,
  failure: NormalizedFailure
): CandidateValidation {
  const context = failure.traceContext;
  if (!context) {
    return {
      status: "unknown",
      reasons: ["no trace context available for validation"]
    };
  }

  const matchCount = countMatches(candidate.locator, failure);
  if (matchCount === undefined) {
    return {
      status: "unknown",
      reasons: ["candidate strategy is not statically validated yet"]
    };
  }

  if (matchCount === 1) {
    return {
      status: "passed",
      matchCount,
      reasons: ["candidate resolves to one trace-backed element"]
    };
  }

  if (matchCount === 0) {
    return {
      status: "failed",
      matchCount,
      reasons: ["candidate did not match trace DOM or accessibility evidence"]
    };
  }

  return {
    status: "failed",
    matchCount,
    reasons: [`candidate matched ${matchCount} trace-backed elements`]
  };
}

function countMatches(locator: string, failure: NormalizedFailure): number | undefined {
  const role = parseRoleLocator(locator);
  if (role) {
    return countRoleMatches(role.role, role.name, failure);
  }

  const testId = parseStringArg(locator, "getByTestId");
  if (testId) {
    return countTestIdMatches(testId, failure);
  }

  const text = parseStringArg(locator, "getByText");
  if (text) {
    return countTextMatches(text, failure);
  }

  return undefined;
}

function countRoleMatches(role: string, name: string, failure: NormalizedFailure): number {
  const context = failure.traceContext;
  if (!context) return 0;

  const axMatches = context.accessibilityNodes.filter(
    (node) => node.role === role && node.name === name
  ).length;

  if (axMatches > 0) {
    return axMatches;
  }

  return context.domSnapshots.reduce((count, snapshot) => {
    const html = snapshot.html ?? "";
    const rolePattern = new RegExp(`role=["']${escapeRegExp(role)}["']`, "g");
    const namePattern = new RegExp(escapeRegExp(name), "g");
    return count + Math.min(countRegex(html, rolePattern), countRegex(html, namePattern));
  }, 0);
}

function countTestIdMatches(testId: string, failure: NormalizedFailure): number {
  const context = failure.traceContext;
  if (!context) return 0;

  const selectorMatches = context.accessibilityNodes.filter((node) =>
    node.selector?.includes(testId)
  ).length;

  const domMatches = context.domSnapshots.reduce((count, snapshot) => {
    const html = snapshot.html ?? "";
    return count + countRegex(html, new RegExp(`data-testid=["']${escapeRegExp(testId)}["']`, "g"));
  }, 0);

  return Math.max(selectorMatches, domMatches);
}

function countTextMatches(text: string, failure: NormalizedFailure): number {
  const context = failure.traceContext;
  if (!context) return 0;

  return context.domSnapshots.reduce((count, snapshot) => {
    return count + countOccurrences(`${snapshot.text ?? ""} ${snapshot.html ?? ""}`, text);
  }, 0);
}

function parseRoleLocator(locator: string): { role: string; name: string } | undefined {
  const match = locator.match(/getByRole\("([^"]+)",\s*\{\s*name:\s*"([^"]+)"\s*\}\)/);
  if (!match) {
    return undefined;
  }

  return { role: match[1], name: match[2] };
}

function parseStringArg(locator: string, method: string): string | undefined {
  return locator.match(new RegExp(`${method}\\("([^"]+)"\\)`))?.[1];
}

function countRegex(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

function countOccurrences(value: string, needle: string): number {
  if (!needle) return 0;
  return value.split(needle).length - 1;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
