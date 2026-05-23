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

export type PatchDiagnostic = {
  testFile: string;
  testTitle: string;
  severity: "info" | "warn";
  message: string;
};

export type PatchReport = {
  changes: PatchChange[];
  diagnostics: PatchDiagnostic[];
};

export async function generateDryRunPatches(
  result: AnalyzeResult,
  sourceRoot: string
): Promise<PatchChange[]> {
  return (await generateDryRunPatchReport(result, sourceRoot)).changes;
}

export async function generateDryRunPatchReport(
  result: AnalyzeResult,
  sourceRoot: string
): Promise<PatchReport> {
  const changes: PatchChange[] = [];
  const diagnostics: PatchDiagnostic[] = [];

  for (const suggestion of result.suggestions) {
    const patchResult = await generatePatchForSuggestion(suggestion, sourceRoot);
    if ("change" in patchResult) {
      changes.push(patchResult.change);
    } else {
      diagnostics.push(patchResult.diagnostic);
    }
  }

  return { changes, diagnostics };
}

export function renderPatchSet(changesOrReport: PatchChange[] | PatchReport): string {
  const report = Array.isArray(changesOrReport)
    ? { changes: changesOrReport, diagnostics: [] }
    : changesOrReport;
  const sections: string[] = [];

  if (report.changes.length === 0) {
    sections.push("No safe dry-run patches available.");
  } else {
    sections.push(report.changes.map((change) => change.diff).join("\n"));
  }

  if (report.diagnostics.length > 0) {
    sections.push(
      [
        "Patch diagnostics:",
        ...report.diagnostics.map(
          (diagnostic) =>
            `- [${diagnostic.severity}] ${diagnostic.testFile} (${diagnostic.testTitle}): ${diagnostic.message}`
        )
      ].join("\n")
    );
  }

  return sections.join("\n\n");
}

async function generatePatchForSuggestion(
  suggestion: HealingSuggestion,
  sourceRoot: string
): Promise<{ change: PatchChange } | { diagnostic: PatchDiagnostic }> {
  if (!suggestion.recommended || !suggestion.failure.failedSelector) {
    return {
      diagnostic: createDiagnostic(
        suggestion,
        "warn",
        "No recommended locator or failed selector was available for patch generation."
      )
    };
  }

  if (suggestion.recommended.validation?.status === "failed") {
    return {
      diagnostic: createDiagnostic(
        suggestion,
        "warn",
        `Recommended locator failed validation: ${suggestion.recommended.validation.reasons.join("; ")}`
      )
    };
  }

  const filePath = resolve(sourceRoot, suggestion.failure.testFile);
  let source: string;
  try {
    source = await readFile(filePath, "utf8");
  } catch (error) {
    return {
      diagnostic: createDiagnostic(
        suggestion,
        "warn",
        `Could not read source file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      )
    };
  }

  const replacementPlan = findAstReplacementPlan(
    source,
    suggestion.failure.failedSelector,
    suggestion.recommended.locator
  );

  if (!replacementPlan) {
    return {
      diagnostic: createDiagnostic(
        suggestion,
        "warn",
        `Could not locate exactly one AST locator call matching ${suggestion.failure.failedSelector}. The source may be ambiguous or already changed.`
      )
    };
  }

  const nextSource = replaceOnce(source, replacementPlan.search, replacementPlan.replacement);

  return {
    change: {
      filePath,
      originalLocator: replacementPlan.search,
      replacementLocator: replacementPlan.replacement,
      diff: renderUnifiedDiff(filePath, source, nextSource),
      diagnostics: replacementPlan.diagnostics
    }
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

function createDiagnostic(
  suggestion: HealingSuggestion,
  severity: PatchDiagnostic["severity"],
  message: string
): PatchDiagnostic {
  return {
    testFile: suggestion.failure.testFile,
    testTitle: suggestion.failure.testTitle,
    severity,
    message
  };
}
