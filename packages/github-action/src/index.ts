import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { analyzeFailures, defaultConfig, renderMarkdownReport } from "@helix-heal/core";
import { ingestPlaywrightJsonReport } from "@helix-heal/playwright-ingest";

async function run(): Promise<void> {
  const reportPath = core.getInput("playwright-report") || "playwright-report.json";
  const minConfidence = Number(core.getInput("min-confidence") || "0.75");
  const token = core.getInput("github-token");

  const failures = await ingestPlaywrightJsonReport(resolve(process.cwd(), reportPath));
  const result = analyzeFailures({
    failures,
    config: {
      ...defaultConfig,
      minSuggestionConfidence: Number.isFinite(minConfidence) ? minConfidence : 0.75
    }
  });

  const body = renderMarkdownReport(result);
  const reportOutput = resolve(process.cwd(), "helix-heal-report.md");
  await writeFile(reportOutput, body, "utf8");
  core.setOutput("report-path", reportOutput);
  core.setOutput("suggestion-count", String(result.suggestions.length));

  if (token && github.context.payload.pull_request) {
    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;
    const issue_number = github.context.payload.pull_request.number;

    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number,
      body
    });
  } else {
    core.info("No pull request context or token found; skipped PR comment.");
  }
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});

