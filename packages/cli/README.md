# helix-heal

Local-first selector healing for Playwright. Helix reads failed Playwright evidence, ranks safer locator candidates, and produces reviewable dry-run patches.

```bash
npx helix-heal analyze --report playwright-report.json --trace test-results --source-root .
npx helix-heal patch --dry-run --report playwright-report.json --trace test-results --source-root .
npx helix-heal dashboard --report playwright-report.json --trace test-results --source-root .
```

Known limits are explicit by design: unsupported selector patterns receive diagnostics, ambiguous DOM lowers confidence, and live validation requires Playwright browsers plus a reachable app URL.

Live validation is optional and requires Playwright browsers:

```bash
npx playwright install chromium
npx helix-heal analyze --report playwright-report.json --trace test-results --live-url http://localhost:3000
```
