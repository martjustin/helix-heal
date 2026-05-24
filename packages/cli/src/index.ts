#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  analyzeFailures,
  applyLiveValidationWithPage,
  applyHealCache,
  generateDryRunPatchReport,
  loadConfig,
  readHealCache,
  renderDashboardHtml,
  renderMarkdownReport,
  renderPatchSet,
  renderTextReport,
  updateHealCacheFromResult,
  writeHealCache,
  type AnalyzeResult,
  type HelixConfig
} from "@helix-heal/core";
import { extractTraceContext, ingestPlaywrightJsonReport } from "@helix-heal/playwright-ingest";
import { renderDoctorReport, runDoctorChecks } from "./doctor.js";

type CliOptions = {
  command: string;
  report?: string;
  output?: string;
  trace?: string;
  dryRun?: boolean;
  sourceRoot?: string;
  liveUrl?: string;
  noCache?: boolean;
};

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.command === "help" || options.command === "--help" || options.command === "-h") {
    printHelp();
    return;
  }

  if (options.command === "doctor") {
    await runDoctor();
    return;
  }

  if (options.command === "patch") {
    await runPatch(options);
    return;
  }

  if (options.command === "dashboard") {
    await runDashboard(options);
    return;
  }

  if (options.command !== "analyze") {
    throw new Error(`Unknown command: ${options.command}`);
  }

  await runAnalyze(options);
}

async function runDashboard(options: CliOptions): Promise<void> {
  const cwd = process.cwd();
  const outputPath = resolve(cwd, options.output ?? ".helix/helix-dashboard.html");
  const result = await analyzeFromOptions(options);
  const cache = await readHealCache(resolve(cwd, ".helix/heal-cache.json"));
  const html = renderDashboardHtml(result, cache);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, "utf8");
  console.log(`Dashboard written to ${outputPath}`);
}

async function runPatch(options: CliOptions): Promise<void> {
  if (!options.dryRun) {
    throw new Error("Patch currently supports --dry-run only.");
  }

  const cwd = process.cwd();
  const outputPath = resolve(cwd, options.output ?? ".helix/helix-heal.patch");
  const result = await analyzeFromOptions(options);
  const patchReport = await generateDryRunPatchReport(
    result,
    resolve(cwd, options.sourceRoot ?? ".")
  );
  const patch = renderPatchSet(patchReport);

  console.log(patch);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, patch, "utf8");
  console.log(`\nDry-run patch written to ${outputPath}`);
}

async function runAnalyze(options: CliOptions): Promise<void> {
  const cwd = process.cwd();
  const outputPath = resolve(cwd, options.output ?? ".helix/helix-heal-report.md");
  const result = await analyzeFromOptions(options);

  console.log(renderTextReport(result));

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, renderMarkdownReport(result), "utf8");
  console.log(`\nMarkdown report written to ${outputPath}`);
}

async function analyzeFromOptions(options: CliOptions) {
  const cwd = process.cwd();
  const reportPath = resolve(cwd, options.report ?? "playwright-report.json");
  const config = await loadConfig(cwd);
  const sourceRoot = resolve(cwd, options.sourceRoot ?? ".");
  const cachePath = resolve(cwd, ".helix/heal-cache.json");
  const rawFailures = await ingestPlaywrightJsonReport(reportPath);
  const traceContext = options.trace
    ? await extractTraceContext(resolve(cwd, options.trace), {
        failedSelector: rawFailures[0]?.failedSelector
      })
    : undefined;
  const failures = rawFailures.map((failure) => ({
    ...failure,
    traceContext: traceContext ?? failure.traceContext,
    pageUrl: failure.pageUrl ?? traceContext?.pageUrl
  }));
  const result = analyzeFailures({ failures, config });

  if (!options.noCache) {
    const cache = await readHealCache(cachePath);
    await applyHealCache(result, cache, sourceRoot, config);
  }

  if (options.liveUrl) {
    await applyOptionalLiveValidation(result, config, options.liveUrl);
  }

  if (!options.noCache) {
    const cache = await readHealCache(cachePath);
    const updatedCache = await updateHealCacheFromResult(cache, result, sourceRoot);
    await writeHealCache(cachePath, updatedCache);
  }

  return result;
}

async function applyOptionalLiveValidation(
  result: AnalyzeResult,
  config: HelixConfig,
  liveUrl: string
): Promise<void> {
  try {
    const playwright = await import("playwright");
    const browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(liveUrl);
    await applyLiveValidationWithPage(result, config, page);
    await browser.close();
  } catch (error) {
    console.warn(
      `Live validation skipped: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function runDoctor(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const checks = await runDoctorChecks({
    cwd: process.cwd(),
    report: options.report,
    trace: options.trace,
    sourceRoot: options.sourceRoot
  });
  console.log(renderDoctorReport(checks));
}

function parseArgs(args: string[]): CliOptions {
  const [command = "help", ...rest] = args;
  const options: CliOptions = { command };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    const next = rest[index + 1];

    if (arg === "--report" && next) {
      options.report = next;
      index += 1;
    } else if (arg === "--output" && next) {
      options.output = next;
      index += 1;
    } else if (arg === "--trace" && next) {
      options.trace = next;
      index += 1;
    } else if (arg === "--source-root" && next) {
      options.sourceRoot = next;
      index += 1;
    } else if (arg === "--live-url" && next) {
      options.liveUrl = next;
      index += 1;
    } else if (arg === "--no-cache") {
      options.noCache = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`Helix Heal

Usage:
  helix-heal analyze --report playwright-report.json
  helix-heal patch --dry-run --report playwright-report.json
  helix-heal dashboard --report playwright-report.json
  helix-heal doctor

Options:
  --report   Path to Playwright JSON report
  --output   Path for Markdown report
  --trace    Path to a Playwright trace zip or extracted trace directory
  --source-root  Directory used to resolve test file paths for patches
  --live-url  Optional URL for live Playwright validation
  --no-cache  Disable .helix/heal-cache.json reads and writes
  --dry-run  Print a reviewable patch without applying it
`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
