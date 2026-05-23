import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeFailures } from "./analyze.js";
import { defaultConfig } from "./config.js";
import { generateDryRunPatchReport, generateDryRunPatches, renderPatchSet } from "./patch.js";

describe("generateDryRunPatches", () => {
  it("creates a reviewable diff for a validated locator replacement", async () => {
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

    const changes = await generateDryRunPatches(
      result,
      resolve(process.cwd(), "../../examples/basic-playwright")
    );

    expect(changes).toHaveLength(1);
    expect(changes[0]?.diagnostics).toContain(
      "AST located exactly one matching Playwright locator call"
    );
    expect(renderPatchSet(changes)).toContain(
      'await page.getByRole("button", { name: "Log in" }).click();'
    );
  });

  it("refuses ambiguous locator replacements", async () => {
    const result = analyzeFailures({
      config: defaultConfig,
      failures: [
        {
          testTitle: "ambiguous",
          testFile: "tests/ambiguous.spec.ts",
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
                html: '<button aria-label="Log in">Log in</button>'
              }
            ],
            accessibilityNodes: [{ role: "button", name: "Log in" }]
          }
        }
      ]
    });

    const report = await generateDryRunPatchReport(
      result,
      resolve(process.cwd(), "../../examples/basic-playwright")
    );

    expect(report.changes).toHaveLength(0);
    expect(report.diagnostics[0]?.message).toContain("Could not locate exactly one AST locator call");
    expect(renderPatchSet(report)).toContain("Patch diagnostics:");
  });
});
