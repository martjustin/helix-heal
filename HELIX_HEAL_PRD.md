# Helix Heal PRD

## Product Summary

Helix Heal is a local-first self-healing assistant for Playwright test suites. It detects broken selectors from failed test runs, analyzes the application DOM and accessibility tree, proposes safer replacement selectors, and posts reviewable healing suggestions in the developer workflow.

The first product is not a full AI testing platform. It is a focused repair tool for the most painful and frequent E2E testing problem: locator breakage.

## Go-To-Market Thesis

QA and engineering teams already using Playwright lose meaningful time maintaining brittle tests. Most teams do not want to adopt a new test framework, migrate test management systems, or trust an autonomous agent with their CI pipeline. They may, however, adopt a small tool that plugs into their existing Playwright suite and gives them useful repair suggestions immediately.

Helix Heal wins if it becomes the easiest way to answer:

> "This Playwright test failed because the UI changed. What selector should I use now?"

## Target Users

### Primary User

Frontend engineers, QA automation engineers, and full-stack engineers who own Playwright tests in active product teams.

### Secondary User

Technical QA leads who want to reduce test maintenance time without buying a large enterprise testing platform.

### Early Adopter Profile

- Uses Playwright today.
- Has recurring locator failures in CI.
- Reviews test failures in GitHub pull requests.
- Is comfortable running an `npx` CLI.
- Wants private/local analysis before trusting hosted AI.

## Problem

Playwright tests often fail when UI structure, labels, roles, IDs, or class names change. Developers then inspect traces, reproduce failures, find the new element, update selectors, rerun tests, and repeat. This is expensive, repetitive, and frustrating.

Existing test platforms either bundle this capability into larger paid suites or require teams to move into proprietary workflows. Helix Heal should solve the repair problem without asking the team to replace Playwright, CI, GitHub, or their current test structure.

## Product Goal

Reduce the time required to diagnose and repair broken Playwright selectors by at least 50% for supported locator failures.

## Non-Goals

The MVP will not include:

- AI test generation.
- Visual regression.
- Contract testing.
- Performance testing.
- Test data generation.
- Full hosted dashboard.
- Test management.
- Cross-framework support beyond Playwright.
- Fully autonomous patch merging.

These may become future modules only after the self-healing wedge proves demand.

## Core Use Cases

### Use Case 1: Local Diagnosis

A developer runs:

```bash
npx helix-heal analyze --report playwright-report --trace test-results
```

Helix reads the failed Playwright artifacts, identifies broken locator failures, analyzes the DOM/accessibility context, and prints suggested replacement locators with confidence scores.

### Use Case 2: CI Pull Request Comment

A GitHub Action runs after Playwright tests fail. Helix posts a PR comment summarizing:

- Failed test.
- Broken selector.
- Likely replacement selector.
- Confidence score.
- Reasoning.
- Suggested patch when safe.

### Use Case 3: Local Patch Proposal

A developer runs:

```bash
npx helix-heal patch --dry-run
```

Helix generates a reviewable patch against the affected test file but does not apply it by default.

### Use Case 4: Cached Repeat Healing

If a selector has been successfully healed before, Helix uses `.helix/heal-cache.json` to suggest the prior repair instantly without another model call.

## MVP Feature Set

### 1. CLI

Command name:

```bash
npx helix-heal
```

Required commands:

```bash
npx helix-heal analyze
npx helix-heal patch --dry-run
npx helix-heal doctor
```

Optional command for v1.1:

```bash
npx helix-heal apply --confidence 0.9
```

### 2. Playwright Artifact Ingestion

Inputs:

- Playwright JSON report.
- Playwright trace directory or zip.
- Test result directories.
- Source test files.

MVP should support the common Playwright setup first:

```bash
npx playwright test --reporter=json
```

### 3. Failure Classification

Helix should classify failures into:

- Broken locator.
- Timeout waiting for element.
- Element hidden or detached.
- Ambiguous locator.
- Non-selector failure.

Only selector-related failures are eligible for healing in the MVP.

### 4. DOM and Accessibility Reconnaissance

For each eligible failure, Helix should capture or reconstruct:

- Failed selector.
- Test file and line number.
- Page URL when available.
- Nearby Playwright action.
- Relevant DOM snapshot.
- Accessibility tree when available.
- Candidate elements with role, name, text, test ID, attributes, and DOM path.

### 5. Healing Engine

The healing engine ranks replacement locator candidates using deterministic rules first:

- Prefer `getByRole` with accessible name.
- Prefer `getByLabel`, `getByPlaceholder`, and `getByText` when stable.
- Prefer configured test ID attributes.
- Avoid brittle CSS chains.
- Avoid nth-child style selectors unless no better option exists.
- Penalize duplicated matches.
- Penalize hidden or disabled candidates.

LLM assistance should be optional in the MVP and used only to explain or rank ambiguous candidates, not as the sole source of truth.

### 6. Confidence Score

Each suggestion receives a score from `0.00` to `1.00`.

Initial scoring factors:

- Candidate uniquely resolves to one element.
- Candidate role/name matches failed intent.
- Candidate appears near the old DOM location.
- Candidate matches surrounding test action.
- Candidate passes a validation probe.
- Candidate follows configured selector rules.

Confidence bands:

- `0.90+`: strong auto-patch candidate.
- `0.75-0.89`: recommend human review.
- `0.50-0.74`: weak suggestion, show alternatives.
- Below `0.50`: do not suggest a patch.

### 7. Patch Generation

Helix should produce a unified diff that replaces only the broken locator expression.

Constraints:

- Never rewrite unrelated test code.
- Never change assertions unless explicitly supported later.
- Never apply patches by default.
- Preserve formatting where possible.

### 8. GitHub Action

MVP Action behavior:

- Runs after Playwright failure.
- Executes Helix analysis.
- Posts one PR comment with summarized healing suggestions.
- Uploads a Markdown report as an artifact.

Example:

```yaml
- name: Helix Heal
  if: failure()
  uses: helix-labs/helix-heal-action@v1
  with:
    playwright-report: playwright-report
    test-results: test-results
    min-confidence: 0.75
```

### 9. Local Cache

Cache path:

```text
.helix/heal-cache.json
```

Cache entries should include:

- Project fingerprint.
- Test file path.
- Original selector.
- Replacement selector.
- Confidence score.
- Validation result.
- Timestamp.
- Helix version.

### 10. Configuration

Config file:

```text
.helix/config.json
```

MVP options:

```json
{
  "testIdAttribute": "data-testid",
  "minSuggestionConfidence": 0.75,
  "minAutoPatchConfidence": 0.9,
  "allowLLM": false,
  "preferredLocators": ["role", "label", "testId", "text"],
  "excludePaths": ["node_modules", "dist", "build"]
}
```

## User Experience

### CLI Output

The CLI should be concise and action-oriented:

```text
Helix Heal found 2 selector-related failures.

1. tests/login.spec.ts:18
   Failed: page.getByText("Sign in")
   Suggest: page.getByRole("button", { name: "Log in" })
   Confidence: 0.91
   Reason: unique button match, same interaction target, validated in DOM snapshot

Run:
  npx helix-heal patch --dry-run
```

### GitHub PR Comment

The comment should include:

- Summary table.
- Suggested locator.
- Confidence.
- Reason.
- Patch block or artifact link.
- Clear warning for low confidence suggestions.

## Success Metrics

### Product Metrics

- Median time from selector failure to usable patch suggestion.
- Percentage of selector failures with valid suggestions.
- Percentage of accepted suggestions.
- Percentage of suggestions above `0.90` confidence.
- Repeat healing served from cache.

### MVP Validation Targets

Within 90 days:

- Heal suggestions produced for at least 60% of supported locator failures.
- At least 80% of high-confidence suggestions are accepted in test repos.
- Local analysis completes in under 30 seconds for a typical failed run.
- GitHub Action integration takes under 15 minutes to install.
- At least 10 real Playwright users test the tool.

### Business Validation Targets

Within 6 months:

- 1,000 GitHub stars or equivalent developer interest signal.
- 100 active weekly repositories.
- 10 paying Pro customers or consultant users.
- Clear evidence that users want hosted analytics or faster hosted healing.

## Pricing Hypothesis

### Starter

Price: Free

Includes:

- Local CLI.
- Local cache.
- GitHub Action.
- Markdown reports.
- Optional local LLM support.

### Pro

Price: $49/month per team workspace

Potential future features:

- Hosted healing API.
- Faster model-backed ranking.
- Team healing dashboard.
- Historical failure analytics.
- Repository-level trend reports.
- Priority support.

### Consultant

Price: $199/month

Potential future features:

- Multiple client workspaces.
- Branded reports.
- Exportable maintenance summaries.
- Client-ready ROI reporting.

## Risks

### Risk 1: Healing Quality Is Too Low

If suggestions are wrong, developers will stop trusting Helix.

Mitigation:

- Deterministic ranking first.
- Conservative confidence scores.
- Human review by default.
- Auto-patch only at very high confidence.

### Risk 2: Playwright Artifacts Are Incomplete

Some failed runs may not include enough DOM or trace data to infer a fix.

Mitigation:

- Provide `doctor` command.
- Clearly explain missing artifact requirements.
- Offer recommended Playwright config.

### Risk 3: LLM Latency or Cost Hurts Adoption

Local models may be slow, and hosted models may create privacy concerns.

Mitigation:

- Make LLM optional.
- Use deterministic candidate generation.
- Use LLM only for ambiguous ranking/explanation.

### Risk 4: Existing Platforms Copy the Feature

Large platforms already have AI testing capabilities.

Mitigation:

- Win on developer workflow, local-first trust, open-source adoption, and narrow excellence.
- Avoid broad platform positioning until there is usage data.

## Architecture Overview

## System Architecture

```text
Playwright Failure Artifacts
          |
          v
Artifact Ingestion Layer
          |
          v
Failure Classifier
          |
          v
Context Builder
          |
          v
Candidate Locator Generator
          |
          v
Deterministic Ranker
          |
          v
Optional LLM Ranker / Explainer
          |
          v
Validation Probe
          |
          v
Patch Generator + Report Generator
          |
          v
CLI Output / GitHub PR Comment / Markdown Artifact
```

## Main Components

### 1. CLI Layer

Responsibilities:

- Parse commands and flags.
- Locate config.
- Detect project type.
- Run analysis pipeline.
- Render terminal output.
- Return correct exit codes for CI.

Suggested package:

```text
packages/cli
```

### 2. Artifact Ingestion Layer

Responsibilities:

- Read Playwright JSON reports.
- Locate trace files and test result directories.
- Normalize failed test data.
- Map failures back to test files and line numbers.

Suggested package:

```text
packages/playwright-ingest
```

Core output type:

```ts
type NormalizedFailure = {
  testTitle: string;
  testFile: string;
  line?: number;
  errorMessage: string;
  failedSelector?: string;
  action?: "click" | "fill" | "expect" | "hover" | "selectOption";
  tracePath?: string;
  pageUrl?: string;
};
```

### 3. Failure Classifier

Responsibilities:

- Detect selector-related errors.
- Exclude unsupported failures.
- Assign failure category.

Example categories:

```ts
type FailureCategory =
  | "broken_locator"
  | "timeout_waiting_for_element"
  | "ambiguous_locator"
  | "element_not_visible"
  | "non_selector_failure";
```

### 4. Context Builder

Responsibilities:

- Extract DOM snapshots from traces when available.
- Extract accessibility tree when available.
- Capture candidate elements around the likely target.
- Prepare structured context for the ranker.

Core output type:

```ts
type HealingContext = {
  failure: NormalizedFailure;
  oldLocator: string;
  domSnapshot?: DomSnapshot;
  accessibilityTree?: AccessibilityNode[];
  sourceSnippet?: string;
  configuredRules: HelixConfig;
};
```

### 5. Candidate Locator Generator

Responsibilities:

- Generate possible Playwright locators.
- Prefer resilient locator strategies.
- Deduplicate candidates.
- Reject clearly unsafe candidates.

Candidate examples:

```ts
page.getByRole("button", { name: "Log in" })
page.getByLabel("Email")
page.getByTestId("submit-login")
page.getByPlaceholder("you@example.com")
```

### 6. Deterministic Ranker

Responsibilities:

- Score candidates without AI.
- Produce transparent reasons.
- Enforce confidence thresholds.

Ranking factors:

- Uniqueness.
- Accessibility match.
- Text/name similarity.
- Old selector proximity.
- Test action compatibility.
- Selector stability.
- Config preference.

### 7. Optional LLM Adapter

Responsibilities:

- Explain ambiguous candidate choices.
- Re-rank candidates when deterministic confidence is inconclusive.
- Never invent selectors outside the candidate set for MVP.

Supported providers later:

- Local Ollama.
- OpenAI.
- LiteLLM gateway.

MVP default:

```json
{
  "allowLLM": false
}
```

### 8. Validation Probe

Responsibilities:

- Confirm candidate selector resolves to the expected element.
- Confirm uniqueness.
- Optionally replay the failed action in a controlled Playwright context.

MVP can start with static validation from artifacts, then add live replay.

### 9. Patch Generator

Responsibilities:

- Locate the failed selector in source.
- Generate minimal diff.
- Preserve surrounding code.
- Avoid risky rewrites.

Implementation note:

Use TypeScript AST parsing for locator replacement when possible. Fall back to text replacement only when the match is exact and unique.

### 10. Report Generator

Responsibilities:

- Render terminal summary.
- Render Markdown report.
- Render GitHub PR comment body.
- Include confidence, reason, and suggested patch.

### 11. Cache Layer

Responsibilities:

- Store prior successful healing suggestions.
- Reuse known repairs.
- Invalidate stale cache by project fingerprint and file hash.

Suggested path:

```text
.helix/heal-cache.json
```

### 12. GitHub Action Wrapper

Responsibilities:

- Install and run Helix Heal in CI.
- Read paths from Action inputs.
- Post or update a PR comment.
- Upload Markdown report artifact.

## Proposed Repository Structure

```text
helix-heal/
  packages/
    cli/
    core/
    playwright-ingest/
    github-action/
  examples/
    basic-playwright/
    github-action/
  docs/
    getting-started.md
    playwright-config.md
    confidence-scoring.md
  .github/
    workflows/
  package.json
  README.md
```

## Data Flow

1. Developer or CI runs Playwright.
2. Playwright produces report and trace artifacts.
3. Helix ingests artifacts and normalizes failures.
4. Failure classifier selects selector-related failures.
5. Context builder extracts DOM/accessibility evidence.
6. Candidate generator creates possible locator replacements.
7. Ranker scores candidates.
8. Validation probe confirms whether top candidates are usable.
9. Patch generator creates reviewable diff.
10. Report generator outputs CLI summary, Markdown, or PR comment.
11. Cache stores accepted or validated healing decisions.

## Build Phases

### Phase 1: Local Analyzer

Timeline: Weeks 1-3

Deliverables:

- CLI scaffold.
- Playwright JSON report ingestion.
- Failure classification.
- Basic selector extraction.
- Terminal suggestions.

Exit criteria:

- Can identify selector failures from sample Playwright reports.

### Phase 2: Candidate Generation and Ranking

Timeline: Weeks 4-6

Deliverables:

- DOM/accessibility context extraction.
- Candidate locator generation.
- Deterministic confidence scoring.
- Markdown report.

Exit criteria:

- Produces useful suggestions for curated broken selector fixtures.

### Phase 3: Patch Proposals

Timeline: Weeks 7-8

Deliverables:

- Source locator replacement.
- Dry-run unified diff.
- Cache v1.

Exit criteria:

- Can generate minimal patches for supported locator patterns.

### Phase 4: GitHub Action

Timeline: Weeks 9-10

Deliverables:

- GitHub Action wrapper.
- PR comment report.
- Artifact upload.

Exit criteria:

- Works on a public example repo with failing Playwright tests.

### Phase 5: Field Validation

Timeline: Weeks 11-12

Deliverables:

- Test against real Playwright projects.
- Improve confidence scoring.
- Add `doctor` command.
- Prepare public launch docs.

Exit criteria:

- At least 10 external users or repositories test the MVP.

## Technical Stack

Recommended MVP stack:

- TypeScript.
- Node.js.
- Playwright.
- Commander or CAC for CLI.
- Zod for config validation.
- TypeScript compiler API or ts-morph for AST edits.
- GitHub Actions toolkit for PR comments.
- Vitest for unit tests.
- Fixture-based integration tests.

## Security and Privacy

Default posture:

- Local-first.
- No artifact upload by default.
- No model call by default.
- No source code sent to hosted services unless explicitly configured.

Required safeguards:

- Redact secrets from reports.
- Avoid logging full environment variables.
- Provide clear config for disabling LLM features.
- Keep PR comments concise and avoid exposing sensitive DOM data.

## Launch Positioning

Recommended positioning:

> Helix Heal fixes broken Playwright locators before they waste your afternoon.

Supporting claim:

> Local-first selector healing for Playwright. Reviewable patches, GitHub PR comments, and confidence-scored suggestions.

Avoid claiming:

- Full autonomous QA.
- Complete AI testing platform.
- Guaranteed self-healing.
- Enterprise-ready lifecycle automation.

## MVP Decision

Build Helix Heal.

Do not build the full Helix platform yet.

The product earns the right to expand only if it proves that developers trust and reuse its selector repair suggestions in real Playwright suites.
