# Publishing

Helix Heal is structured so the CLI can be published as the public `helix-heal` npm package.

## Package Shape

- Root package: private monorepo only.
- CLI package: `packages/cli`, published as `helix-heal`.
- Internal packages: bundled into the CLI output for the cleanest `npx` install path.
- Optional peer dependency: `playwright`, used only for `--live-url` validation.

## Publish Checklist

```bash
npm ci
npm run build
npm run typecheck
npm test
npm audit --audit-level=moderate
npm pack -w helix-heal --dry-run
npm publish -w helix-heal --access public
```

If `npm whoami` returns `ENEEDAUTH`, run `npm login` first or configure an npm automation token in the environment.

## Consumer Install

```bash
npx helix-heal analyze --report playwright-report.json --trace test-results --source-root .
```

For live validation:

```bash
npm install -D playwright
npx playwright install chromium
npx helix-heal analyze --report playwright-report.json --trace test-results --live-url http://localhost:3000
```
