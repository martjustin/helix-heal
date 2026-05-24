import { stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import * as core from "@actions/core";
import * as github from "@actions/github";
import artifact from "@actions/artifact";
import {
  analyzeFailures,
  defaultConfig,
  generateDryRunPatchReport,
  readHealCache,
  renderDashboardHtml,
  renderMarkdownReport,
  renderPatchSet
} from "@helix-heal/core";
import { extractTraceContext, ingestPlaywrightJsonReport } from "@helix-heal/playwright-ingest";
import { buildGitHubComment, findExistingHelixComment } from "./comment.js";

async function run(): Promise<void> {
  const reportPath = getActionInput("playwright-report", "HELIX_PLAYWRIGHT_REPORT", "playwright-report.json");
  const tracePath = getActionInput("trace", "HELIX_TRACE", "");
  const sourceRoot = getActionInput("source-root", "HELIX_SOURCE_ROOT", ".");
  const minConfidence = Number(getActionInput("min-confidence", "HELIX_MIN_CONFIDENCE", "0.75"));
  const token = getActionInput("github-token", "HELIX_GITHUB_TOKEN", "");
  const resolvedTracePath = tracePath ? resolve(process.cwd(), tracePath) : undefined;
  const traceContext = resolvedTracePath && (await exists(resolvedTracePath))
    ? await extractTraceContext(resolvedTracePath)
    : undefined;

  const failures = (await ingestPlaywrightJsonReport(resolve(process.cwd(), reportPath))).map((failure) => ({
    ...failure,
    traceContext: traceContext ?? failure.traceContext,
    pageUrl: failure.pageUrl ?? traceContext?.pageUrl
  }));
  const result = analyzeFailures({
    failures,
    config: {
      ...defaultConfig,
      minSuggestionConfidence: Number.isFinite(minConfidence) ? minConfidence : 0.75
    }
  });

  const body = renderMarkdownReport(result);
  const patchReport = await generateDryRunPatchReport(result, resolve(process.cwd(), sourceRoot));
  const patch = renderPatchSet(patchReport);
  const cache = await readHealCache(resolve(process.cwd(), ".helix/heal-cache.json"));
  const dashboard = renderDashboardHtml(result, cache);
  const commentBody = buildGitHubComment(body, patch);
  const reportOutput = resolve(process.cwd(), "helix-heal-report.md");
  const patchOutput = resolve(process.cwd(), "helix-heal.patch");
  const dashboardOutput = resolve(process.cwd(), "helix-heal-dashboard.html");
  await writeFile(reportOutput, body, "utf8");
  await writeFile(patchOutput, patch, "utf8");
  await writeFile(dashboardOutput, dashboard, "utf8");
  core.setOutput("report-path", reportOutput);
  core.setOutput("patch-path", patchOutput);
  core.setOutput("dashboard-path", dashboardOutput);
  core.setOutput("suggestion-count", String(result.suggestions.length));
  core.setOutput("patch-count", String(patchReport.changes.length));

  await uploadArtifacts([reportOutput, patchOutput, dashboardOutput]);

  if (token && github.context.payload.pull_request) {
    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;
    const issue_number = github.context.payload.pull_request.number;
    const existingComments = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number,
      per_page: 100
    });
    const existingComment = findExistingHelixComment(existingComments.data);

    if (existingComment) {
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existingComment.id,
        body: commentBody
      });
      core.setOutput("comment-action", "updated");
      core.setOutput("comment-id", String(existingComment.id));
    } else {
      const comment = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number,
        body: commentBody
      });
      core.setOutput("comment-action", "created");
      core.setOutput("comment-id", String(comment.data.id));
    }
  } else {
    core.info("No pull request context or token found; skipped PR comment.");
  }
}

function getActionInput(name: string, envName: string, fallback: string): string {
  return core.getInput(name) || process.env[envName] || fallback;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function uploadArtifacts(files: string[]): Promise<void> {
  try {
    await artifact.uploadArtifact("helix-heal-report", files, dirname(files[0]));
    core.setOutput("artifact-name", "helix-heal-report");
  } catch (error) {
    core.warning(`Artifact upload skipped: ${error instanceof Error ? error.message : String(error)}`);
  }
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
