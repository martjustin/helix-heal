import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ingestPlaywrightJsonReport } from "./index.js";

describe("ingestPlaywrightJsonReport", () => {
  it("normalizes failed Playwright results", async () => {
    const reportPath = resolve(
      process.cwd(),
      "../../examples/basic-playwright/fixtures/playwright-report.json"
    );

    const failures = await ingestPlaywrightJsonReport(reportPath);

    expect(failures).toHaveLength(1);
    expect(failures[0]?.testTitle).toBe("user can sign in");
    expect(failures[0]?.failedSelector).toBe('getByText("Sign in")');
  });

  it("normalizes nested suites, retries, stacks, projects, and trace attachments", async () => {
    const reportPath = resolve(
      process.cwd(),
      "../../examples/basic-playwright/fixtures/nested-report.json"
    );

    const failures = await ingestPlaywrightJsonReport(reportPath);

    expect(failures).toHaveLength(2);
    expect(failures[0]).toMatchObject({
      testTitle: "checkout submit button works",
      testFile: "tests/checkout.spec.ts",
      line: 12,
      column: 5,
      projectName: "chromium",
      retry: 1,
      status: "failed",
      failedSelector: 'locator("[data-testid=\\"submit-order\\"]")',
      action: "click",
      tracePath: "test-results/checkout-retry1/trace.zip"
    });
    expect(failures[0]?.attachments).toHaveLength(1);
    expect(failures[1]?.failedSelector).toBe('getByRole("button", { name: "Save" })');
  });
});
