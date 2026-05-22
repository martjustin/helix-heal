#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  analyzeFailures,
  generateDryRunPatches,
  loadConfig,
  renderMarkdownReport,
  renderPatchSet,
  renderTextReport
} from "@helix-heal/core";
import { extractTraceContext, ingestPlaywrightJsonReport } from "@helix-heal/playwright-ingest";

type CliOptions = {
  command: string;
  report?: string;
  output?: string;
  trace?: string;
  dryRun?: boolean;
  sourceRoot?: string;
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

  if (options.command !== "analyze") {
    throw new Error(`Unknown command: ${options.command}`);
  }

  await runAnalyze(options);
}

async function runPatch(options: CliOptions): Promise<void> {
  if (!options.dryRun) {
    throw new Error("Patch currently supports --dry-run only.");
  }

  const cwd = process.cwd();
  const outputPath = resolve(cwd, options.output ?? ".helix/helix-heal.patch");
  const result = await analyzeFromOptions(options);
  const changes = await generateDryRunPatches(
    result,
    resolve(cwd, options.sourceRoot ?? ".")
  );
  const patch = renderPatchSet(changes);

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
  const traceContext = options.trace
    ? await extractTraceContext(resolve(cwd, options.trace))
    : undefined;
  const failures = (await ingestPlaywrightJsonReport(reportPath)).map((failure) => ({
    ...failure,
    traceContext: traceContext ?? failure.traceContext,
    pageUrl: failure.pageUrl ?? traceContext?.pageUrl
  }));
  return analyzeFailures({ failures, config });
}

async function runDoctor(): Promise<void> {
  const config = await loadConfig(process.cwd());
  console.log("Helix Heal doctor");
  console.log(`- testIdAttribute: ${config.testIdAttribute}`);
  console.log(`- minSuggestionConfidence: ${config.minSuggestionConfidence}`);
  console.log(`- allowLLM: ${config.allowLLM}`);
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
  helix-heal doctor

Options:
  --report   Path to Playwright JSON report
  --output   Path for Markdown report
  --trace    Path to a Playwright trace zip or extracted trace directory
  --source-root  Directory used to resolve test file paths for patches
  --dry-run  Print a reviewable patch without applying it
`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
