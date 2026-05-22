#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { analyzeFailures, loadConfig, renderMarkdownReport, renderTextReport } from "@helix-heal/core";
import { extractTraceContext, ingestPlaywrightJsonReport } from "@helix-heal/playwright-ingest";

type CliOptions = {
  command: string;
  report?: string;
  output?: string;
  trace?: string;
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

  if (options.command !== "analyze") {
    throw new Error(`Unknown command: ${options.command}`);
  }

  await runAnalyze(options);
}

async function runAnalyze(options: CliOptions): Promise<void> {
  const cwd = process.cwd();
  const reportPath = resolve(cwd, options.report ?? "playwright-report.json");
  const outputPath = resolve(cwd, options.output ?? ".helix/helix-heal-report.md");
  const config = await loadConfig(cwd);
  const failures = await ingestPlaywrightJsonReport(reportPath);
  const traceContext = options.trace
    ? await extractTraceContext(resolve(cwd, options.trace))
    : undefined;
  const result = analyzeFailures({ failures, config });

  if (traceContext) {
    for (const suggestion of result.suggestions) {
      suggestion.failure.traceContext = traceContext;
      suggestion.failure.pageUrl ??= traceContext.pageUrl;
    }
  }

  console.log(renderTextReport(result));

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, renderMarkdownReport(result), "utf8");
  console.log(`\nMarkdown report written to ${outputPath}`);
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
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`Helix Heal

Usage:
  helix-heal analyze --report playwright-report.json
  helix-heal doctor

Options:
  --report   Path to Playwright JSON report
  --output   Path for Markdown report
  --trace    Path to a Playwright trace zip or extracted trace directory
`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
