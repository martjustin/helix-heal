import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { AnalyzeResult, HealingSuggestion } from "./types.js";

export type PatchChange = {
  filePath: string;
  originalLocator: string;
  replacementLocator: string;
  diff: string;
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
  const replacementPlan = findReplacementPlan(
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
    diff: renderUnifiedDiff(filePath, source, nextSource)
  };
}

function findReplacementPlan(
  source: string,
  failedSelector: string,
  recommendedLocator: string
): { search: string; replacement: string } | undefined {
  const pageFailedSelector = failedSelector.startsWith("page.")
    ? failedSelector
    : `page.${failedSelector}`;

  if (source.includes(pageFailedSelector)) {
    return {
      search: pageFailedSelector,
      replacement: recommendedLocator
    };
  }

  if (source.includes(failedSelector)) {
    return {
      search: failedSelector,
      replacement: stripPagePrefix(recommendedLocator)
    };
  }

  return undefined;
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
