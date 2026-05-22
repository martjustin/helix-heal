import { access, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { ingestPlaywrightJsonReport } from "@helix-heal/playwright-ingest";
import { loadConfig, readHealCache } from "@helix-heal/core";

export type DoctorOptions = {
  cwd: string;
  report?: string;
  trace?: string;
  sourceRoot?: string;
};

export type DoctorCheck = {
  status: "pass" | "warn" | "fail";
  label: string;
  detail: string;
};

export async function runDoctorChecks(options: DoctorOptions): Promise<DoctorCheck[]> {
  const cwd = options.cwd;
  const reportPath = resolve(cwd, options.report ?? "playwright-report.json");
  const sourceRoot = resolve(cwd, options.sourceRoot ?? ".");
  const checks: DoctorCheck[] = [];

  checks.push(await checkConfig(cwd));
  checks.push(await checkSourceRoot(sourceRoot));
  checks.push(await checkReport(reportPath));
  checks.push(await checkTrace(cwd, options.trace));
  checks.push(await checkPlaywrightConfig(sourceRoot));
  checks.push(await checkCache(resolve(cwd, ".helix/heal-cache.json")));

  return checks;
}

export function renderDoctorReport(checks: DoctorCheck[]): string {
  const lines = ["Helix Heal doctor", ""];

  for (const check of checks) {
    lines.push(`${symbolFor(check.status)} ${check.label}: ${check.detail}`);
  }

  if (
    checks.some(
      (check) =>
        check.status !== "pass" &&
        ["Playwright report", "Trace artifacts", "Playwright config"].includes(check.label)
    )
  ) {
    lines.push("", "Recommended Playwright config:", "", "```ts");
    lines.push(`import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: [
    ["list"],
    ["json", { outputFile: "playwright-report.json" }],
    ["html", { outputFolder: "playwright-report" }]
  ],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  }
});`);
    lines.push("```");
  }

  return lines.join("\n");
}

async function checkConfig(cwd: string): Promise<DoctorCheck> {
  const configPath = resolve(cwd, ".helix/config.json");
  try {
    await access(configPath);
    const config = await loadConfig(cwd);
    return {
      status: "pass",
      label: "Config",
      detail: `loaded .helix/config.json with min confidence ${config.minSuggestionConfidence}`
    };
  } catch {
    return {
      status: "warn",
      label: "Config",
      detail: "using defaults; create .helix/config.json when you need custom thresholds"
    };
  }
}

async function checkSourceRoot(sourceRoot: string): Promise<DoctorCheck> {
  return (await pathExists(sourceRoot))
    ? { status: "pass", label: "Source root", detail: sourceRoot }
    : { status: "fail", label: "Source root", detail: `${sourceRoot} does not exist` };
}

async function checkReport(reportPath: string): Promise<DoctorCheck> {
  if (!(await pathExists(reportPath))) {
    return {
      status: "warn",
      label: "Playwright report",
      detail: `${reportPath} not found; pass --report or enable the JSON reporter`
    };
  }

  try {
    const failures = await ingestPlaywrightJsonReport(reportPath);
    return {
      status: "pass",
      label: "Playwright report",
      detail: `${failures.length} failed result(s) parsed`
    };
  } catch (error) {
    return {
      status: "fail",
      label: "Playwright report",
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}

async function checkTrace(cwd: string, trace: string | undefined): Promise<DoctorCheck> {
  if (!trace) {
    return {
      status: "warn",
      label: "Trace artifacts",
      detail: "no --trace path supplied; enable trace: retain-on-failure for DOM-aware healing"
    };
  }

  const tracePath = resolve(cwd, trace);
  return (await pathExists(tracePath))
    ? { status: "pass", label: "Trace artifacts", detail: tracePath }
    : { status: "warn", label: "Trace artifacts", detail: `${tracePath} not found` };
}

async function checkPlaywrightConfig(sourceRoot: string): Promise<DoctorCheck> {
  const candidates = ["playwright.config.ts", "playwright.config.js", "playwright.config.mjs"];
  let configPath: string | undefined;

  for (const candidate of candidates) {
    const candidatePath = resolve(sourceRoot, candidate);
    if (await pathExists(candidatePath)) {
      configPath = candidatePath;
      break;
    }
  }

  if (!configPath) {
    return {
      status: "warn",
      label: "Playwright config",
      detail: "not found in source root"
    };
  }

  const content = await readFile(configPath, "utf8");
  const hasJsonReporter = content.includes("json");
  const hasTrace = content.includes("retain-on-failure") || content.includes("trace: \"on\"");

  if (hasJsonReporter && hasTrace) {
    return {
      status: "pass",
      label: "Playwright config",
      detail: "JSON reporter and failure traces appear configured"
    };
  }

  return {
    status: "warn",
    label: "Playwright config",
    detail: "add JSON reporter and trace: retain-on-failure for best results"
  };
}

async function checkCache(cachePath: string): Promise<DoctorCheck> {
  const cache = await readHealCache(cachePath);
  return cache.entries.length > 0
    ? { status: "pass", label: "Heal cache", detail: `${cache.entries.length} cached repair(s)` }
    : { status: "warn", label: "Heal cache", detail: "no cached repairs yet" };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function symbolFor(status: DoctorCheck["status"]): string {
  if (status === "pass") return "[pass]";
  if (status === "warn") return "[warn]";
  return "[fail]";
}
