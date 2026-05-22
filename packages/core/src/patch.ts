import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";
import type { AnalyzeResult, HealingSuggestion } from "./types.js";

export type PatchChange = {
  filePath: string;
  originalLocator: string;
  replacementLocator: string;
  diff: string;
  diagnostics: string[];
};

export async function generateDryRunPatches(
  result: AnalyzeResult,
  sourceRoot: string
): Promise<PatchChange[]> {
  const changes: PatchChange[] = [];

  for (const suggestion of result.suggestions) {
    const change = await generatePatchForSuggestion(suggestion, sourceRoot);
    if (change) {
      changes.push(change);
    }
  }

  return changes;
}

export function renderPatchSet(changes: PatchChange[]): string {
  if (changes.length === 0) {
    return "No safe dry-run patches available.";
  }

  return changes.map((change) => change.diff).join("\n");
}

async function generatePatchForSuggestion(
  suggestion: HealingSuggestion,
  sourceRoot: string
): Promise<PatchChange | undefined> {
  if (!suggestion.recommended || !suggestion.failure.failedSelector) {
    return undefined;
  }

  if (suggestion.recommended.validation?.status === "failed") {
    return undefined;
  }

  const filePath = resolve(sourceRoot, suggestion.failure.testFile);
  const source = await readFile(filePath, "utf8");
  const replacementPlan = findAstReplacementPlan(
    source,
    suggestion.failure.failedSelector,
    suggestion.recommended.locator
  );

  if (!replacementPlan) {
    return undefined;
  }

  const nextSource = replaceOnce(source, replacementPlan.search, replacementPlan.replacement);

  return {
    filePath,
    originalLocator: replacementPlan.search,
    replacementLocator: replacementPlan.replacement,
    diff: renderUnifiedDiff(filePath, source, nextSource),
    diagnostics: replacementPlan.diagnostics
  };
}

function findAstReplacementPlan(
  source: string,
  failedSelector: string,
  recommendedLocator: string
): { search: string; replacement: string; diagnostics: string[] } | undefined {
  const pageFailedSelector = failedSelector.startsWith("page.")
    ? failedSelector
    : `page.${failedSelector}`;
  const candidates = findLocatorCalls(source).filter((candidate) => {
    const text = normalizeSource(candidate.text);
    return (
      text === normalizeSource(pageFailedSelector) ||
      text === normalizeSource(failedSelector)
    );
  });

  if (candidates.length !== 1) {
    return undefined;
  }

  const candidate = candidates[0];
  const originalLocator = source.slice(candidate.start, candidate.end);
  const originalUsesPage = normalizeSource(originalLocator).startsWith("page.");

  return {
    search: originalLocator,
    replacement: originalUsesPage ? recommendedLocator : stripPagePrefix(recommendedLocator),
    diagnostics: ["AST located exactly one matching Playwright locator call"]
  };
}

function replaceOnce(source: string, search: string, replacement: string): string {
  const index = source.indexOf(search);
  if (index < 0) {
    return source;
  }

  return `${source.slice(0, index)}${replacement}${source.slice(index + search.length)}`;
}

function renderUnifiedDiff(filePath: string, before: string, after: string): string {
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const changedIndex = beforeLines.findIndex((line, index) => line !== afterLines[index]);

  if (changedIndex < 0) {
    return "";
  }

  const start = Math.max(0, changedIndex - 2);
  const end = Math.min(beforeLines.length, changedIndex + 3);
  const hunkLines = [`--- a/${filePath}`, `+++ b/${filePath}`, `@@`];

  for (let index = start; index < end; index += 1) {
    if (index === changedIndex) {
      hunkLines.push(`-${beforeLines[index]}`);
      hunkLines.push(`+${afterLines[index]}`);
    } else {
      hunkLines.push(` ${beforeLines[index]}`);
    }
  }

  return hunkLines.join("\n");
}

function stripPagePrefix(locator: string): string {
  return locator.startsWith("page.") ? locator.slice("page.".length) : locator;
}

function findLocatorCalls(source: string): Array<{ text: string; start: number; end: number }> {
  const file = ts.createSourceFile("test.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const calls: Array<{ text: string; start: number; end: number }> = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && isPlaywrightLocatorCall(node)) {
      calls.push({
        text: node.getText(file),
        start: node.getStart(file),
        end: node.getEnd()
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(file);
  return calls;
}

function isPlaywrightLocatorCall(node: ts.CallExpression): boolean {
  const expression = node.expression;
  if (ts.isPropertyAccessExpression(expression)) {
    const name = expression.name.text;
    if (name === "locator" || name.startsWith("getBy")) {
      return true;
    }
  }

  if (ts.isIdentifier(expression)) {
    return expression.text === "locator" || expression.text.startsWith("getBy");
  }

  return false;
}

function normalizeSource(value: string): string {
  return value.replace(/\s+/g, "");
}
