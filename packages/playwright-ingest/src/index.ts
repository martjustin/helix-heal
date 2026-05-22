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

function visitSuiteArray(
  value: unknown,
  failures: NormalizedFailure[],
  inheritedFile?: string
): void {
  if (!Array.isArray(value)) {
    return;
  }

  for (const suite of value) {
    if (!isRecord(suite)) {
      continue;
    }

    const suiteFile = stringValue(suite.file) ?? inheritedFile;
    visitSpecArray(suite.specs, failures, suiteFile);
    visitSuiteArray(suite.suites, failures, suiteFile);
  }
}

function visitSpecArray(
  value: unknown,
  failures: NormalizedFailure[],
  inheritedFile?: string
): void {
  if (!Array.isArray(value)) {
    return;
  }

  for (const spec of value) {
    if (!isRecord(spec)) {
      continue;
    }

    const title = stringValue(spec.title) ?? "Untitled Playwright test";
    const file = stringValue(spec.file) ?? inheritedFile ?? "unknown";
    const line = numberValue(spec.line);
    const column = numberValue(spec.column);
    visitTestArray(spec.tests, { title, file, line, column }, failures);
  }
}

function visitTestArray(
  value: unknown,
  spec: { title: string; file: string; line?: number; column?: number },
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

      const error = extractError(result);
      const attachments = extractAttachments(result);
      const tracePath = attachments.find((attachment) => attachment.name === "trace")?.path;

      failures.push({
        testTitle: spec.title,
        testFile: spec.file,
        line: spec.line,
        column: spec.column,
        projectName: stringValue(test.projectName),
        retry: numberValue(result.retry),
        status: stringValue(result.status),
        errorMessage: error.message,
        errorStack: error.stack,
        failedSelector: extractSelector(`${error.message}\n${error.stack ?? ""}`),
        action: inferAction(`${error.message}\n${error.stack ?? ""}`),
        tracePath,
        attachments
      });
    }
  }
}

function extractError(result: UnknownRecord): { message: string; stack?: string } {
  if (typeof result.error === "string") {
    return { message: result.error };
  }

  if (isRecord(result.error) && typeof result.error.message === "string") {
    return {
      message: result.error.message,
      stack: typeof result.error.stack === "string" ? result.error.stack : undefined
    };
  }

  if (Array.isArray(result.errors) && result.errors.length > 0) {
    const first = result.errors[0];
    if (isRecord(first) && typeof first.message === "string") {
      return {
        message: first.message,
        stack: typeof first.stack === "string" ? first.stack : undefined
      };
    }
  }

  return { message: "Unknown Playwright failure" };
}

function extractAttachments(result: UnknownRecord): NonNullable<NormalizedFailure["attachments"]> {
  if (!Array.isArray(result.attachments)) {
    return [];
  }

  return result.attachments
    .filter(isRecord)
    .map((attachment) => ({
      name: stringValue(attachment.name) ?? "attachment",
      contentType: stringValue(attachment.contentType),
      path: stringValue(attachment.path)
    }));
}

function extractSelector(message: string): string | undefined {
  const callPatterns = [
    /page\.locator\(/,
    /locator\(/,
    /getBy[A-Za-z0-9]+\(/,
    /\$\(/
  ];

  for (const pattern of callPatterns) {
    const matchIndex = message.search(pattern);
    if (matchIndex >= 0) {
      const expression = readCallExpression(message.slice(matchIndex));
      if (expression) {
        return stripPagePrefix(expression);
      }
    }
  }

  const waitingFor = message.match(/waiting for\s+([^\n]+)/i);
  if (waitingFor?.[1]) {
    return waitingFor[1].trim();
  }

  return undefined;
}

function readCallExpression(value: string): string | undefined {
  const openIndex = value.indexOf("(");
  if (openIndex < 0) {
    return undefined;
  }

  let depth = 0;
  let quote: string | undefined;
  let escaped = false;

  for (let index = openIndex; index < value.length; index += 1) {
    const char = value[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }

    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;

    if (depth === 0) {
      return value.slice(0, index + 1);
    }
  }

  return undefined;
}

function inferAction(message: string): PlaywrightAction {
  const lower = message.toLowerCase();
  if (lower.includes(".click") || lower.includes("locator.click") || lower.includes("click")) return "click";
  if (lower.includes(".fill") || lower.includes("locator.fill") || lower.includes("fill")) return "fill";
  if (lower.includes("expect")) return "expect";
  if (lower.includes(".hover") || lower.includes("locator.hover") || lower.includes("hover")) return "hover";
  if (message.includes("selectOption")) return "selectOption";
  return "unknown";
}

function stripPagePrefix(expression: string): string {
  return expression.startsWith("page.") ? expression.slice("page.".length) : expression;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}
