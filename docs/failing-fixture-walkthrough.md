# Failing Fixture Walkthrough

This walkthrough mirrors the launch site: fail, analyze, patch, rerun green. It uses the fixture in `examples/basic-playwright` so evaluators can see the product behavior without connecting a private codebase.

## 1. Fail

The fixture test intentionally looks for stale copy:

```ts
await page.getByText("Sign in").click();
```

The page renders a stable accessible button instead:

```html
<button aria-label="Log in" data-testid="login-submit">Log in</button>
```

Run the suite:

```bash
npx playwright test
```

Playwright writes a JSON report and trace evidence for Helix to inspect.

## 2. Analyze

```bash
npm exec --workspace helix-heal -- helix-heal analyze \
  --report examples/basic-playwright/fixtures/playwright-report.json \
  --trace examples/basic-playwright/fixtures/real-trace \
  --source-root examples/basic-playwright
```

Helix maps the failed test, source path, failed locator, and trace DOM evidence. It ranks replacements by accessibility strength, uniqueness, and ambiguity risk.

## 3. Patch

```bash
npm exec --workspace helix-heal -- helix-heal patch --dry-run \
  --report examples/basic-playwright/fixtures/playwright-report.json \
  --trace examples/basic-playwright/fixtures/real-trace \
  --source-root examples/basic-playwright
```

The patch is dry-run first. A developer sees the exact suggested locator change before touching source.

## 4. Rerun Green

After review, apply the locator update and rerun:

```bash
npx playwright test
```

The goal is not silent automation. The goal is a short, evidence-backed repair loop that developers trust.
