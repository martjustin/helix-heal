import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeFailures } from "./analyze.js";
import { defaultConfig } from "./config.js";
import { generateDryRunPatches, renderPatchSet } from "./patch.js";

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
    expect(renderPatchSet(changes)).toContain(
      'await page.getByRole("button", { name: "Log in" }).click();'
    );
  });
});
