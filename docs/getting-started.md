# Getting Started

Helix Heal starts as a local analyzer for Playwright JSON reports.

## Install

```bash
npm install
npm run build
```

## Generate a Playwright JSON Report

In a Playwright project, configure a JSON reporter:

```bash
npx playwright test --reporter=json
```

Save the output as `playwright-report.json`, or point Helix to the report path.

## Analyze Failures

```bash
npx helix-heal analyze --report playwright-report.json
```

Helix will:

- Read the report.
- Extract failed tests.
- Classify selector-related failures.
- Suggest replacement locators where possible.
- Write `.helix/helix-heal-report.md`.

## Check Configuration

```bash
npx helix-heal doctor
```

Copy `.helix/config.example.json` to `.helix/config.json` when you need custom thresholds or selector preferences.

