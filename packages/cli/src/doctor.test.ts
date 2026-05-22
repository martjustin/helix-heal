import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { renderDoctorReport, runDoctorChecks } from "./doctor.js";

describe("doctor", () => {
  it("reports configured Playwright artifacts", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "helix-doctor-"));
    await mkdir(join(cwd, ".helix"));
    await writeFile(
      join(cwd, ".helix/config.json"),
      JSON.stringify({ minSuggestionConfidence: 0.8 }),
      "utf8"
    );
    await writeFile(
      join(cwd, "playwright.config.ts"),
      'export default { reporter: [["json"]], use: { trace: "retain-on-failure" } };',
      "utf8"
    );
    await writeFile(join(cwd, "playwright-report.json"), JSON.stringify({ suites: [] }), "utf8");

    const checks = await runDoctorChecks({ cwd, report: "playwright-report.json", sourceRoot: cwd });
    const report = renderDoctorReport(checks);

    expect(report).toContain("[pass] Config");
    expect(report).toContain("[pass] Playwright config");
    expect(report).toContain("[pass] Playwright report");
  });
});
