# helix-heal

Local-first selector healing for Playwright.

```bash
npx helix-heal analyze --report playwright-report.json --trace test-results --source-root .
npx helix-heal patch --dry-run --report playwright-report.json --trace test-results --source-root .
npx helix-heal dashboard --report playwright-report.json --trace test-results --source-root .
```

Live validation is optional and requires Playwright browsers:

```bash
npx playwright install chromium
npx helix-heal analyze --report playwright-report.json --trace test-results --live-url http://localhost:3000
```

