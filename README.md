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

## Launch Flow: Fail, Analyze, Patch, Rerun Green

This is the core MVP workflow from the public site: a failed Playwright run becomes evidence, a ranked locator suggestion, a dry-run patch, and a green rerun. Helix is intentionally honest about what it does: it narrows selector repair work with trace evidence and confidence scoring. It does not pretend to replace QA judgment.

### 1. Install

```bash
npx helix-heal --help
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

### 6. Rerun Green

Review the patch, apply the locator update, and rerun the suite:

```bash
npx playwright test
```

See [docs/failing-fixture-walkthrough.md](./docs/failing-fixture-walkthrough.md) for the real fixture walkthrough used in the launch page.

### 7. Check Setup

```bash
npx helix-heal doctor \
  --report ./examples/basic-playwright/fixtures/playwright-report.json \
  --trace ./examples/basic-playwright/fixtures/real-trace \
  --source-root ./examples/basic-playwright
```

### 8. Share the Static Dashboard

```bash
npx helix-heal dashboard \
  --report ./examples/basic-playwright/fixtures/playwright-report.json \
  --trace ./examples/basic-playwright/fixtures/real-trace \
  --source-root ./examples/basic-playwright
```

This writes `.helix/helix-dashboard.html`, a static team artifact for the latest healing run and cache state.

## Known Limits

Helix is built to be useful without sounding magical.

- Unsupported selectors: complex dynamic locators may receive diagnostics instead of an automatic patch.
- Ambiguous DOM: multiple matching elements lower confidence and require review before a patch is trusted.
- Live validation: browser-backed validation requires an installed Playwright browser and a reachable app URL.

## Pricing Direction

- Starter: `$0` for local CLI, dry-run patches, Markdown reports, static dashboard, and community support.
- Pro: planned `$49/month` for hosted validation, team dashboard, repair analytics, and priority support.
- Consultant: planned `$199/month` for client workspaces, white-label reports, branded exports, and delivery support.

The paid tiers are product direction, not a claim that hosted services are already live.

## Quick Start

```bash
npx helix-heal analyze \
  --report examples/basic-playwright/fixtures/playwright-report.json \
  --trace examples/basic-playwright/fixtures/real-trace \
  --source-root examples/basic-playwright
```

## GitHub Action

See [docs/github-action.md](./docs/github-action.md) for PR comment and artifact upload setup.

## Publishing

See [docs/publishing.md](./docs/publishing.md) for the npm publish checklist and `npx helix-heal` install path.

## Product Direction

See [HELIX_HEAL_PRD.md](./HELIX_HEAL_PRD.md) for the product scope, architecture, success metrics, and 90-day build plan.
