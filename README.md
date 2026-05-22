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

## Quick Start

```bash
npm install
npm run build
npm run --workspace @helix-heal/cli helix-heal -- analyze --report examples/basic-playwright/fixtures/playwright-report.json
```

## Product Direction

See [HELIX_HEAL_PRD.md](./HELIX_HEAL_PRD.md) for the product scope, architecture, success metrics, and 90-day build plan.

