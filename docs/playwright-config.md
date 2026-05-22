# Playwright Configuration

Helix Heal needs enough failure evidence to understand what broke.

Recommended Playwright settings:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: [
    ["list"],
    ["json", { outputFile: "playwright-report.json" }],
    ["html", { outputFolder: "playwright-report" }]
  ],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  }
});
```

For the MVP, the JSON report is the required input. Trace and DOM extraction are planned in the next implementation phase.

