# Product Readiness Report

## Current Completion

Helix Heal is a focused Playwright locator-repair MVP with the essential launch surfaces in place:

- Published npm CLI: `npx helix-heal`.
- Local artifact analysis for Playwright JSON reports and trace evidence.
- DOM/accessibility-backed locator candidates.
- Conservative confidence scoring.
- Dry-run patch generation.
- Local cache.
- Static Markdown and HTML reporting.
- GitHub Action wrapper for reports, patches, dashboard artifacts, and PR comments.
- Public launch site with pricing hypothesis, demo GIF, limitations, and analytics hooks.

Estimated readiness:

- Core MVP implementation: `85%`.
- Launch credibility: `80%`.
- Intensive marketing readiness: `70%`.

## Verification Coverage

Automated E2E coverage now lives in `npm run test:e2e` and validates:

- Published npm install smoke, unless skipped in CI with `HELIX_E2E_SKIP_PUBLISHED=1`.
- Local CLI help, doctor, missing-input diagnostics, analysis, patch, dashboard.
- Flat and nested Playwright report ingestion.
- Missing and unreadable trace degradation.
- Selector-only scoping for non-selector failures.
- DOM-aware candidate generation and ambiguity blocking.
- Confidence gating for no-trace and duplicate-element cases.
- Failing fixture walkthrough: fail, analyze, dry-run patch, apply suggested change, rerun green.
- Cache write, cache reuse, malformed-cache warning, and `--no-cache`.
- Static and live validation.
- GitHub Action artifact output without PR context.
- Local-first source privacy scan.
- Dashboard and 100-failure scale smoke.

Static site E2E remains in `npm run site:verify` and validates:

- Desktop and mobile layout.
- Accessibility landmarks, labels, alt text, focus and contrast samples.
- Sidebar collapse.
- Module search and empty state.
- Demo GIF loading.
- Pricing navigation.
- Analytics events for page view, install click, and repo click.

## Market Demand

The demand thesis is credible but not self-proving. Teams are adopting Playwright and experimenting with AI-assisted QA, but experienced buyers distrust broad "AI testing platform" claims. Helix should keep winning on the narrow wedge: repair broken Playwright locators without forcing a platform migration.

Strong signals:

- Locator maintenance is a recurring engineering pain.
- Local-first analysis reduces privacy and procurement friction.
- Dry-run patches fit developer review habits.
- `npx` install reduces first-run friction.

Weak signals:

- No external repository validation yet.
- No public GitHub Action demo PR yet.
- No measured acceptance rate for high-confidence suggestions.
- Hosted Pro features are hypotheses, not shipped product.

## What To Add Next

- Public demo repository with a real failing PR, Helix Action comment, artifacts, patch, and green rerun.
- Redacted fixtures from at least five external Playwright projects.
- Benchmark report comparing manual repair time against Helix suggestion time.
- `helix-heal apply --confidence 0.9` behind explicit opt-in.
- Secret redaction tests for reports and PR comments.
- More locator patterns: placeholder, chained locators, frame locators, component-library DOM, dynamic lists.
- `doctor --github-action` setup checklist.
- Opt-in telemetry for anonymized command success, failure category, and patch acceptance.

## What To Avoid

- Do not expand into AI test generation before locator repair is trusted.
- Do not add visual regression, contract testing, performance testing, or test data factory yet.
- Do not claim autonomous QA, guaranteed self-healing, or enterprise lifecycle automation.
- Do not imply hosted Pro functionality is live before it exists.
- Do not promote confidence scores without external acceptance-rate evidence.

## Intensive Marketing Gate

Broad marketing should wait until:

- `npm run test:e2e` passes in CI.
- `npm run site:verify` passes locally and against GitHub Pages.
- A public demo PR proves fail to PR comment to patch to green.
- At least 20 fixture scenarios pass.
- At least 5 external repos run Helix successfully.
- At least 10 real users test it.
- At least 80% of high-confidence suggestions are accepted or judged correct in test repos.
