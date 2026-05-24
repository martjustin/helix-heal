import { describe, expect, it } from "vitest";
import { renderDashboardHtml } from "./dashboard.js";

describe("renderDashboardHtml", () => {
  it("renders a static team dashboard from suggestions and cache entries", () => {
    const html = renderDashboardHtml(
      {
        unsupported: [],
        suggestions: [
          {
            category: "broken_locator",
            failure: {
              testTitle: "login",
              testFile: "tests/login.spec.ts",
              errorMessage: "waiting for getByText",
              failedSelector: 'getByText("Sign in")'
            },
            candidates: [],
            recommended: {
              locator: 'page.getByRole("button", { name: "Log in" })',
              strategy: "role",
              source: "deterministic",
              evidence: [],
              confidence: 0.95,
              reasons: []
            }
          }
        ]
      },
      {
        version: 1,
        entries: [
          {
            testFile: "tests/login.spec.ts",
            fileHash: "abc",
            originalSelector: 'getByText("Sign in")',
            replacementSelector: 'page.getByRole("button", { name: "Log in" })',
            confidence: 0.95,
            timestamp: "2026-05-24T00:00:00.000Z"
          }
        ]
      }
    );

    expect(html).toContain("Helix Heal Dashboard");
    expect(html).toContain("Cached repairs");
    expect(html).toContain("tests/login.spec.ts");
  });
});
