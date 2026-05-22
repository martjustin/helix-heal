import type { AnalyzeResult, HealingSuggestion } from "./types.js";

export function renderTextReport(result: AnalyzeResult): string {
  const lines = [`Helix Heal found ${result.suggestions.length} selector-related failure(s).`];

  if (result.unsupported.length > 0) {
    lines.push(`${result.unsupported.length} failure(s) were not eligible for healing.`);
  }

  result.suggestions.forEach((suggestion, index) => {
    lines.push("", renderSuggestion(suggestion, index + 1));
  });

  return lines.join("\n");
}

export function renderMarkdownReport(result: AnalyzeResult): string {
  const lines = [
    "# Helix Heal Report",
    "",
    `Selector-related failures: ${result.suggestions.length}`,
    `Unsupported failures: ${result.unsupported.length}`,
    ""
  ];

  for (const suggestion of result.suggestions) {
    lines.push(`## ${suggestion.failure.testTitle}`);
    lines.push("");
    lines.push(`- File: \`${suggestion.failure.testFile}\``);
    lines.push(`- Category: \`${suggestion.category}\``);

    if (suggestion.failure.failedSelector) {
      lines.push(`- Failed selector: \`${suggestion.failure.failedSelector}\``);
    }

    if (suggestion.failure.pageUrl) {
      lines.push(`- Page URL: \`${suggestion.failure.pageUrl}\``);
    }

    if (suggestion.failure.traceContext) {
      lines.push(
        `- Trace context: ${suggestion.failure.traceContext.domSnapshots.length} DOM snapshot(s), ${suggestion.failure.traceContext.accessibilityNodes.length} accessibility node(s)`
      );
    }

    if (suggestion.recommended) {
      lines.push(`- Suggested selector: \`${suggestion.recommended.locator}\``);
      lines.push(`- Confidence: \`${suggestion.recommended.confidence.toFixed(2)}\``);
      lines.push(`- Reason: ${suggestion.recommended.reasons.join("; ")}`);
    } else {
      lines.push("- Suggested selector: none available yet");
    }

    lines.push("");
  }

  return lines.join("\n");
}

function renderSuggestion(suggestion: HealingSuggestion, index: number): string {
  const recommended = suggestion.recommended;
  const location = suggestion.failure.line
    ? `${suggestion.failure.testFile}:${suggestion.failure.line}`
    : suggestion.failure.testFile;

  if (!recommended) {
    return `${index}. ${location}\n   No safe locator suggestion yet.`;
  }

  return [
    `${index}. ${location}`,
    `   Failed: ${suggestion.failure.failedSelector ?? "unknown selector"}`,
    `   Suggest: ${recommended.locator}`,
    `   Confidence: ${recommended.confidence.toFixed(2)}`,
    renderTraceSummary(suggestion),
    `   Reason: ${recommended.reasons.join("; ")}`
  ].filter(Boolean).join("\n");
}

function renderTraceSummary(suggestion: HealingSuggestion): string | undefined {
  const context = suggestion.failure.traceContext;
  if (!context) {
    return undefined;
  }

  return `   Trace: ${context.domSnapshots.length} DOM snapshot(s), ${context.accessibilityNodes.length} accessibility node(s)`;
}
