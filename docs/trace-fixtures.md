# Trace Fixtures

Helix keeps trace fixtures that mirror common real-world Playwright failure patterns.

## Current Fixture Coverage

- `real-trace`: Playwright-style `before` / `after` call events plus frame snapshots and resource HTML.
- `form-trace`: failed `locator.fill` against renamed form labels.
- `duplicate-button-trace`: strict-mode duplicate text failure.
- `trace-dir`: compact trace with DOM and accessibility nodes.

## Adding Actual Project Fixtures

From a real Playwright project:

```bash
npx playwright test --trace retain-on-failure --reporter=json
```

Then copy the smallest redacted artifact set into:

```text
examples/basic-playwright/fixtures/<case-name>/
```

Rules:

- Redact tokens, emails, private URLs, and customer data.
- Keep the original `trace.trace` shape when possible.
- Include related resource HTML only when it helps locator generation.
- Add or update a test in `packages/playwright-ingest/src/trace.test.ts`.

The goal is not synthetic perfection. The goal is messy, representative failures that protect Helix from becoming overfit to one happy-path trace.

