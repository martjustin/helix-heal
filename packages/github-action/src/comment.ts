export const HELIX_COMMENT_MARKER = "<!-- helix-heal-report -->";

export type ExistingComment = {
  id: number;
  body?: string | null;
};

export function buildGitHubComment(report: string, patch: string): string {
  const lines = [
    HELIX_COMMENT_MARKER,
    report.trim(),
    "",
    "## Suggested Patch",
    "",
    patch.trim() === "No safe dry-run patches available."
      ? "No safe dry-run patches available."
      : ["```diff", patch.trim(), "```"].join("\n")
  ];

  return lines.join("\n");
}

export function findExistingHelixComment(comments: ExistingComment[]): ExistingComment | undefined {
  return comments.find((comment) => comment.body?.includes(HELIX_COMMENT_MARKER));
}
