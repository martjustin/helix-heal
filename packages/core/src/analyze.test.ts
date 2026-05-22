import { describe, expect, it } from "vitest";
import { analyzeFailures } from "./analyze.js";
import { defaultConfig } from "./config.js";

describe("analyzeFailures", () => {
  it("recommends a locator for supported selector failures", () => {
    const result = analyzeFailures({
      config: defaultConfig,
      failures: [
        {
          testTitle: "user can sign in",
          testFile: "tests/login.spec.ts",
          errorMessage:
            'TimeoutError: locator.click: Timeout 30000ms exceeded. waiting for getByText("Sign in")',
          failedSelector: 'getByText("Sign in")',
          action: "click"
        }
      ]
    });

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]?.recommended?.locator).toContain("getByRole");
    expect(result.unsupported).toHaveLength(0);
  });

  it("prefers candidates discovered from trace DOM and accessibility evidence", () => {
    const result = analyzeFailures({
      config: defaultConfig,
      failures: [
        {
          testTitle: "user can sign in",
          testFile: "tests/login.spec.ts",
          errorMessage:
            'TimeoutError: locator.click: Timeout 30000ms exceeded. waiting for getByText("Sign in")',
          failedSelector: 'getByText("Sign in")',
          action: "click",
          traceContext: {
            tracePath: "trace-dir",
            actions: [],
            domSnapshots: [
              {
                source: "snapshot",
                html: '<main><button aria-label="Log in" data-testid="login-submit">Log in</button></main>'
              }
            ],
            accessibilityNodes: [
              {
                role: "button",
                name: "Log in",
                selector: 'button[data-testid="login-submit"]'
              }
            ]
          }
        }
      ]
    });

    expect(result.suggestions[0]?.candidates.map((candidate) => candidate.locator)).toContain(
      'page.getByRole("button", { name: "Log in" })'
    );
    expect(result.suggestions[0]?.candidates.map((candidate) => candidate.locator)).toContain(
      'page.getByTestId("login-submit")'
    );
    expect(result.suggestions[0]?.recommended?.validation).toMatchObject({
      status: "passed",
      matchCount: 1
    });
  });

  it("separates unsupported failures", () => {
    const result = analyzeFailures({
      config: defaultConfig,
      failures: [
        {
          testTitle: "api returns 200",
          testFile: "tests/api.spec.ts",
          errorMessage: "Expected 200, received 500"
        }
      ]
    });

    expect(result.suggestions).toHaveLength(0);
    expect(result.unsupported).toHaveLength(1);
  });
});
