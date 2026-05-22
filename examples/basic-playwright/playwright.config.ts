import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  reporter: [
    ["list"],
    ["json", { outputFile: "fixtures/playwright-report.json" }]
  ],
  use: {
    trace: "retain-on-failure"
  }
});

