import type { AnalyzeResult } from "./types.js";
import type { HealCache } from "./cache.js";

export function renderDashboardHtml(result: AnalyzeResult, cache: HealCache): string {
  const suggestions = result.suggestions;
  const patches = suggestions.filter((suggestion) => suggestion.recommended).length;
  const avgConfidence =
    suggestions.length === 0
      ? 0
      : suggestions.reduce((sum, suggestion) => sum + (suggestion.recommended?.confidence ?? 0), 0) /
        suggestions.length;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Helix Heal Dashboard</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; color: #17202a; background: #f6f7f9; }
      main { max-width: 1120px; margin: 0 auto; padding: 32px 20px; }
      h1 { font-size: 28px; margin: 0 0 8px; }
      h2 { font-size: 18px; margin-top: 32px; }
      .muted { color: #5f6b7a; }
      .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-top: 24px; }
      .metric, table { background: #fff; border: 1px solid #dfe4ea; border-radius: 8px; }
      .metric { padding: 16px; }
      .metric strong { display: block; font-size: 26px; margin-top: 6px; }
      table { border-collapse: separate; border-spacing: 0; width: 100%; overflow: hidden; }
      th, td { padding: 10px 12px; border-bottom: 1px solid #edf0f3; text-align: left; vertical-align: top; }
      th { font-size: 12px; text-transform: uppercase; color: #5f6b7a; background: #fbfcfd; }
      code { background: #eef2f6; padding: 2px 4px; border-radius: 4px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Helix Heal Dashboard</h1>
      <p class="muted">Static team artifact generated from the latest failed Playwright analysis.</p>
      <section class="metrics">
        ${metric("Selector failures", suggestions.length)}
        ${metric("Recommendations", patches)}
        ${metric("Avg confidence", avgConfidence.toFixed(2))}
        ${metric("Cached repairs", cache.entries.length)}
      </section>
      <h2>Latest Suggestions</h2>
      ${suggestionsTable(result)}
      <h2>Heal Cache</h2>
      ${cacheTable(cache)}
    </main>
  </body>
</html>`;
}

function metric(label: string, value: string | number): string {
  return `<div class="metric"><span class="muted">${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function suggestionsTable(result: AnalyzeResult): string {
  if (result.suggestions.length === 0) {
    return `<p class="muted">No selector-related suggestions in this run.</p>`;
  }

  return `<table>
    <thead><tr><th>Test</th><th>File</th><th>Failed</th><th>Suggested</th><th>Confidence</th></tr></thead>
    <tbody>
      ${result.suggestions
        .map(
          (suggestion) => `<tr>
            <td>${escapeHtml(suggestion.failure.testTitle)}</td>
            <td><code>${escapeHtml(suggestion.failure.testFile)}</code></td>
            <td><code>${escapeHtml(suggestion.failure.failedSelector ?? "unknown")}</code></td>
            <td><code>${escapeHtml(suggestion.recommended?.locator ?? "none")}</code></td>
            <td>${escapeHtml(suggestion.recommended?.confidence.toFixed(2) ?? "-")}</td>
          </tr>`
        )
        .join("")}
    </tbody>
  </table>`;
}

function cacheTable(cache: HealCache): string {
  if (cache.entries.length === 0) {
    return `<p class="muted">No cached repairs yet.</p>`;
  }

  return `<table>
    <thead><tr><th>File</th><th>Original</th><th>Replacement</th><th>Confidence</th></tr></thead>
    <tbody>
      ${cache.entries
        .slice(-20)
        .reverse()
        .map(
          (entry) => `<tr>
            <td><code>${escapeHtml(entry.testFile)}</code></td>
            <td><code>${escapeHtml(entry.originalSelector)}</code></td>
            <td><code>${escapeHtml(entry.replacementSelector)}</code></td>
            <td>${escapeHtml(entry.confidence.toFixed(2))}</td>
          </tr>`
        )
        .join("")}
    </tbody>
  </table>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
