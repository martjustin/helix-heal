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
      mode: "static",
      reasons: ["no trace context available for validation"]
    };
  }

  const matchCount = countMatches(candidate.locator, failure);
  if (matchCount === undefined) {
    return {
      status: "unknown",
      mode: "static",
      reasons: ["candidate strategy is not statically validated yet"]
    };
  }

  if (matchCount === 1) {
    return {
      status: "passed",
      mode: "static",
      matchCount,
      reasons: ["candidate resolves to one trace-backed element"]
    };
  }

  if (matchCount === 0) {
    return {
      status: "failed",
      mode: "static",
      matchCount,
      reasons: ["candidate did not match trace DOM or accessibility evidence"]
    };
  }

  return {
    status: "failed",
    mode: "static",
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

  return uniqueSnapshotHtmls(failure).reduce((count, html) => {
    return count + countRoleElements(html, role, name);
  }, 0);
}

function countTestIdMatches(testId: string, failure: NormalizedFailure): number {
  const context = failure.traceContext;
  if (!context) return 0;

  const selectorMatches = context.accessibilityNodes.filter((node) =>
    node.selector?.includes(testId)
  ).length;

  const domMatches = uniqueSnapshotHtmls(failure).reduce((count, html) => {
    return count + countRegex(html, new RegExp(`data-testid=["']${escapeRegExp(testId)}["']`, "g"));
  }, 0);

  return Math.max(selectorMatches, domMatches);
}

function countTextMatches(text: string, failure: NormalizedFailure): number {
  const context = failure.traceContext;
  if (!context) return 0;

  return uniqueSnapshotTexts(failure).reduce((count, snapshot) => {
    return count + countOccurrences(snapshot, text);
  }, 0);
}

function uniqueSnapshotHtmls(failure: NormalizedFailure): string[] {
  const htmls = failure.traceContext?.domSnapshots.map((snapshot) => snapshot.html ?? "").filter(Boolean) ?? [];
  return [...new Set(htmls.map(normalizeHtml))];
}

function uniqueSnapshotTexts(failure: NormalizedFailure): string[] {
  const values =
    failure.traceContext?.domSnapshots.map((snapshot) =>
      `${snapshot.text ?? ""} ${snapshot.html ?? ""}`.replace(/\s+/g, " ").trim()
    ) ?? [];
  return [...new Set(values.filter(Boolean))];
}

function countRoleElements(html: string, role: string, name: string): number {
  const elementPattern = /<([a-zA-Z][\w:-]*)([^>]*)>([^<]*)/g;
  let count = 0;
  let match: RegExpExecArray | null;

  while ((match = elementPattern.exec(html)) !== null) {
    const [, tag, attrs, text] = match;
    const elementRole = attrValue(attrs, "role") ?? roleFromTag(tag.toLowerCase(), attrs);
    const elementName = attrValue(attrs, "aria-label") ?? text.replace(/\s+/g, " ").trim();

    if (elementRole === role && elementName === name) {
      count += 1;
    }
  }

  return count;
}

function roleFromTag(tag: string, attrs: string): string | undefined {
  if (tag === "button") return "button";
  if (tag === "a" && attrValue(attrs, "href")) return "link";
  if (tag === "input") {
    const type = attrValue(attrs, "type");
    if (type === "submit" || type === "button") return "button";
    return "textbox";
  }
  if (/^h[1-6]$/.test(tag)) return "heading";
  return undefined;
}

function attrValue(attrs: string, name: string): string | undefined {
  const match = attrs.match(new RegExp(`${name}=["']([^"']+)["']`));
  return match?.[1];
}

function normalizeHtml(html: string): string {
  return html.replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();
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
