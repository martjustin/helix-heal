# GitHub Action

Helix Heal can run after Playwright failures, publish a Markdown report, upload patch artifacts, and create or update one PR comment.

## Example Workflow

```yaml
name: Playwright

on:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      issues: write
      actions: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Run Playwright
        id: playwright
        run: npx playwright test --reporter=json
        continue-on-error: true
      - uses: martjustin/helix-heal@main
        if: steps.playwright.outcome == 'failure'
        with:
          playwright-report: playwright-report.json
          trace: test-results
          source-root: .
          min-confidence: "0.75"
      - name: Fail if Playwright failed
        if: steps.playwright.outcome == 'failure'
        run: exit 1
```

The important detail is the `continue-on-error: true` Playwright step followed by the Helix step. That lets Helix inspect the failed run before the job is marked failed.

## Outputs

- `report-path`: local Markdown report path.
- `patch-path`: local dry-run patch path.
- `suggestion-count`: number of selector-related suggestions.
- `patch-count`: number of safe dry-run patches.
- `artifact-name`: uploaded artifact name when artifact upload succeeds.
- `comment-action`: `created` or `updated` when running in pull request context.
- `comment-id`: GitHub comment ID.

## Artifacts

The Action uploads:

- `helix-heal-report.md`
- `helix-heal.patch`
- `helix-heal-dashboard.html`

If GitHub artifact upload is unavailable, the Action logs a warning and continues.
