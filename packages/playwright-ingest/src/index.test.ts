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
});

