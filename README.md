# Helix Heal

Local-first selector healing for Playwright test suites.

Helix Heal analyzes failed Playwright runs, identifies selector-related failures, proposes safer replacement locators, and creates reviewable reports or patches. The MVP is intentionally narrow: fix broken Playwright locators before expanding into broader AI test automation.

## Current Scope

- `npx helix-heal analyze` for failed Playwright reports.
- Selector failure classification.
- Confidence-scored locator suggestions.
- Markdown reports for CI artifacts.
- GitHub Action wrapper for PR comments.
- Local `.helix` config and cache conventions.

## Monorepo Layout

```text
packages/
  cli/                 Command line interface
  core/                Healing pipeline, ranking, reporting, config
  playwright-ingest/   Playwright report and artifact ingestion
  github-action/       GitHub Action wrapper
examples/
  basic-playwright/    Minimal Playwright fixture project
docs/                  Product and implementation docs
```

## Launch Flow: Fail, Heal, Patch

This is the core MVP workflow: configure Playwright, run a failing test, ask Helix for a healing suggestion, then generate a reviewable patch.

### 1. Install

```bash
npm install
npm run build
```

### 2. Configure Playwright

Use a JSON report and keep traces on failure:

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

### 3. Fail a Test

Run your Playwright suite and keep the failed JSON report plus trace artifacts:

```bash
npx playwright test
```

### 4. Heal the Selector

```bash
npx helix-heal analyze \
  --report ./examples/basic-playwright/fixtures/playwright-report.json \
  --trace ./examples/basic-playwright/fixtures/real-trace \
  --source-root ./examples/basic-playwright
```

Helix will classify selector failures, inspect trace DOM evidence, rank candidate locators, validate them, and write `.helix/helix-heal-report.md`.

### 5. Generate a Reviewable Patch

```bash
npx helix-heal patch --dry-run \
  --report ./examples/basic-playwright/fixtures/playwright-report.json \
  --trace ./examples/basic-playwright/fixtures/real-trace \
  --source-root ./examples/basic-playwright
```

The patch is printed and written to `.helix/helix-heal.patch`. Helix does not apply source changes by default.

### 6. Check Setup

```bash
npx helix-heal doctor \
  --report ./examples/basic-playwright/fixtures/playwright-report.json \
  --trace ./examples/basic-playwright/fixtures/real-trace \
  --source-root ./examples/basic-playwright
```

### 7. Share the Static Dashboard

```bash
npx helix-heal dashboard \
  --report ./examples/basic-playwright/fixtures/playwright-report.json \
  --trace ./examples/basic-playwright/fixtures/real-trace \
  --source-root ./examples/basic-playwright
```

This writes `.helix/helix-dashboard.html`, a static team artifact for the latest healing run and cache state.

## Quick Start

```bash
npm install
npm run build
npm run --workspace helix-heal helix-heal -- analyze --report examples/basic-playwright/fixtures/playwright-report.json
```

## GitHub Action

See [docs/github-action.md](./docs/github-action.md) for PR comment and artifact upload setup.

## Publishing

See [docs/publishing.md](./docs/publishing.md) for the npm publish checklist and `npx helix-heal` install path.

## Product Direction

See [HELIX_HEAL_PRD.md](./HELIX_HEAL_PRD.md) for the product scope, architecture, success metrics, and 90-day build plan.
