# Architecture

Helix Heal is a TypeScript monorepo organized around a small analysis pipeline.

```text
Playwright JSON Report
        |
        v
@helix-heal/playwright-ingest
        |
        v
@helix-heal/core
        |
        v
CLI / GitHub Action / Markdown Report
```

## Packages

### `@helix-heal/core`

Owns the product logic:

- Config loading.
- Failure classification.
- Candidate generation.
- Confidence ranking.
- Text and Markdown report rendering.

### `@helix-heal/playwright-ingest`

Owns Playwright-specific input parsing:

- Reads Playwright JSON reports.
- Walks suites, specs, tests, and results.
- Normalizes failed test data for the core pipeline.

### `@helix-heal/cli`

Owns local developer workflow:

- `helix-heal analyze`
- `helix-heal doctor`
- Markdown report output.

### `@helix-heal/github-action`

Owns CI workflow:

- Reads Action inputs.
- Runs the analyzer.
- Writes report artifact.
- Posts a PR comment when running in pull request context.

## Next Architecture Milestones

1. Add trace parsing and DOM snapshot extraction.
2. Add AST-based patch generation.
3. Add local cache reads and writes.
4. Add validation probes.
5. Add optional LLM adapter constrained to existing candidates.

