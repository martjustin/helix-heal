# Roadmap

## Phase 1: Repository Framework

- Monorepo scaffold.
- CLI package.
- Core pipeline package.
- Playwright ingestion package.
- GitHub Action wrapper.
- Example fixture and docs.

## Phase 2: Local Analyzer

- Improve Playwright JSON parsing.
- Add fixture tests.
- Support common selector failure formats.
- Add cache read path.

## Phase 3: DOM-Aware Healing

- Parse Playwright trace artifacts.
- Extract DOM and accessibility evidence.
- Generate role, label, test ID, placeholder, and text candidates.
- Validate candidate uniqueness.

## Phase 4: Patch Generation

- Locate source selector expressions.
- Generate dry-run unified diffs.
- Add AST-safe replacements for supported Playwright locator patterns.

## Phase 5: GitHub Workflow

- Update existing PR comment instead of posting duplicates.
- Upload report artifacts.
- Add confidence filtering.
- Add installable Action documentation.

