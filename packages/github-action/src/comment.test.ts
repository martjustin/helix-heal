import { describe, expect, it } from "vitest";
import { buildGitHubComment, findExistingHelixComment, HELIX_COMMENT_MARKER } from "./comment.js";

describe("GitHub comment helpers", () => {
  it("builds a stable marked comment with a diff block", () => {
    const body = buildGitHubComment("# Helix Heal Report", "--- a/file\n+++ b/file");

    expect(body).toContain(HELIX_COMMENT_MARKER);
    expect(body).toContain("```diff");
    expect(body).toContain("--- a/file");
  });

  it("finds the existing Helix comment", () => {
    expect(
      findExistingHelixComment([
        { id: 1, body: "human comment" },
        { id: 2, body: `${HELIX_COMMENT_MARKER}\nreport` }
      ])?.id
    ).toBe(2);
  });
});
