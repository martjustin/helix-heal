import { readFile } from "node:fs/promises";
import type { NormalizedFailure, PlaywrightAction } from "@helix-heal/core";

type UnknownRecord = Record<string, unknown>;

export async function ingestPlaywrightJsonReport(reportPath: string): Promise<NormalizedFailure[]> {
  const raw = await readFile(reportPath, "utf8");
  const report = JSON.parse(raw) as UnknownRecord;
  const failures: NormalizedFailure[] = [];

  visitSuiteArray(report.suites, failures);

  return failures;
}

function visitSuiteArray(value: unknown, failures: NormalizedFailure[]): void {
  if (!Array.isArray(value)) {
    return;
  }

  for (const suite of value) {
    if (!isRecord(suite)) {
      continue;
    }

    visitSpecArray(suite.specs, failures);
    visitSuiteArray(suite.suites, failures);
  }
}

function visitSpecArray(value: unknown, failures: NormalizedFailure[]): void {
  if (!Array.isArray(value)) {
    return;
  }

  for (const spec of value) {
    if (!isRecord(spec)) {
      continue;
    }

    const title = String(spec.title ?? "Untitled Playwright test");
    const file = String(spec.file ?? "unknown");
    const line = typeof spec.line === "number" ? spec.line : undefined;
    visitTestArray(spec.tests, { title, file, line }, failures);
  }
}

function visitTestArray(
  value: unknown,
  spec: { title: string; file: string; line?: number },
  failures: NormalizedFailure[]
): void {
  if (!Array.isArray(value)) {
    return;
  }

  for (const test of value) {
    if (!isRecord(test) || !Array.isArray(test.results)) {
      continue;
    }

    for (const result of test.results) {
      if (!isRecord(result) || result.status === "passed" || result.status === "skipped") {
        continue;
      }

      const errorMessage = extractErrorMessage(result);

      failures.push({
        testTitle: spec.title,
        testFile: spec.file,
        line: spec.line,
        errorMessage,
        failedSelector: extractSelector(errorMessage),
        action: inferAction(errorMessage)
      });
    }
  }
}

function extractErrorMessage(result: UnknownRecord): string {
  if (typeof result.error === "string") {
    return result.error;
  }

  if (isRecord(result.error) && typeof result.error.message === "string") {
    return result.error.message;
  }

  if (Array.isArray(result.errors) && result.errors.length > 0) {
    const first = result.errors[0];
    if (isRecord(first) && typeof first.message === "string") {
      return first.message;
    }
  }

  return "Unknown Playwright failure";
}

function extractSelector(message: string): string | undefined {
  const locatorMatch = message.match(/locator\((['"`].+?['"`])\)/);
  if (locatorMatch?.[1]) {
    return `locator(${locatorMatch[1]})`;
  }

  const getByIndex = message.search(/getBy[A-Za-z0-9]+\(/);
  if (getByIndex >= 0) {
    return readCallExpression(message.slice(getByIndex));
  }

  return undefined;
}

function readCallExpression(value: string): string | undefined {
  const openIndex = value.indexOf("(");
  if (openIndex < 0) {
    return undefined;
  }

  let depth = 0;

  for (let index = openIndex; index < value.length; index += 1) {
    const char = value[index];

    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;

    if (depth === 0) {
      return value.slice(0, index + 1);
    }
  }

  return undefined;
}

function inferAction(message: string): PlaywrightAction {
  if (message.includes(".click") || message.includes("click")) return "click";
  if (message.includes(".fill") || message.includes("fill")) return "fill";
  if (message.includes("expect")) return "expect";
  if (message.includes(".hover") || message.includes("hover")) return "hover";
  if (message.includes("selectOption")) return "selectOption";
  return "unknown";
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
