const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "packages", "cli", "dist", "index.cjs");
const actionPath = path.join(repoRoot, "packages", "github-action", "dist", "index.cjs");
const exampleRoot = path.join(repoRoot, "examples", "basic-playwright");
const fixturesRoot = path.join(exampleRoot, "fixtures");
const tmpBase = path.join(repoRoot, ".helix");
fs.mkdirSync(tmpBase, { recursive: true });
const tmpRoot = fs.mkdtempSync(path.join(tmpBase, "e2e-"));
const results = [];

function run(command, args, options = {}) {
  const invocation = resolveInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: options.cwd ?? repoRoot,
    env: {
      ...process.env,
      CI: "1",
      NO_COLOR: "1",
      ...(options.env ?? {})
    },
    encoding: "utf8",
    timeout: options.timeout ?? 120000,
    windowsHide: true
  });

  const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (options.expectFailure) {
    assert.notEqual(result.status, 0, `${command} ${args.join(" ")} was expected to fail\n${combined}`);
  } else {
    assert.equal(
      result.status,
      0,
      `${command} ${args.join(" ")} failed${result.error ? `\n${result.error.message}` : ""}\n${combined}`
    );
  }

  return { ...result, combined };
}

function resolveInvocation(command, args) {
  if (process.platform === "win32" && ["npm", "npx"].includes(command)) {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", [command, ...args].map(quoteCmdArg).join(" ")]
    };
  }

  return { command, args };
}

function quoteCmdArg(value) {
  if (!/[\s&()^=;!'+,`~[\]{}]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '\\"')}"`;
}

async function section(name, fn) {
  const startedAt = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - startedAt;
    results.push({ name, status: "pass", durationMs });
    console.log(`PASS ${name} (${durationMs}ms)`);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    results.push({ name, status: "fail", durationMs, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

function copyExampleProject(name) {
  const target = path.join(tmpRoot, name);
  fs.cpSync(exampleRoot, target, {
    recursive: true,
    filter: (source) => !source.includes(`${path.sep}node_modules${path.sep}`)
  });
  return target;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function applySingleLineUnifiedPatch(patchPath, sourcePath) {
  const patch = fs.readFileSync(patchPath, "utf8");
  const removed = patch.split(/\r?\n/).find((line) => line.startsWith("-  await "));
  const added = patch.split(/\r?\n/).find((line) => line.startsWith("+  await "));
  assert.ok(removed, `Patch did not contain a removed locator line:\n${patch}`);
  assert.ok(added, `Patch did not contain an added locator line:\n${patch}`);

  const beforeLine = removed.slice(1);
  const afterLine = added.slice(1);
  const source = fs.readFileSync(sourcePath, "utf8");
  assert.ok(source.includes(beforeLine), `Source did not contain patch removal line: ${beforeLine}`);
  fs.writeFileSync(sourcePath, source.replace(beforeLine, afterLine));
}

async function loadCore() {
  return import(pathToFileURL(path.join(repoRoot, "packages", "core", "dist", "index.js")).href);
}

async function loadIngest() {
  return import(pathToFileURL(path.join(repoRoot, "packages", "playwright-ingest", "dist", "index.js")).href);
}

function makeReport(filePath, title, message) {
  return {
    suites: [
      {
        file: filePath,
        specs: [
          {
            title,
            file: filePath,
            tests: [
              {
                projectName: "chromium",
                results: [
                  {
                    status: "failed",
                    retry: 0,
                    errors: [{ message }]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
}

async function main() {
  assert.ok(fs.existsSync(cliPath), "CLI dist build is missing. Run npm run build first.");
  assert.ok(fs.existsSync(actionPath), "GitHub Action dist build is missing. Run npm run build first.");

  await section("public npm install and CLI smoke", async () => {
    if (process.env.HELIX_E2E_SKIP_PUBLISHED === "1") {
      console.log("SKIP published npx smoke because HELIX_E2E_SKIP_PUBLISHED=1");
      return;
    }

    const help = run("npx", ["--yes", "helix-heal", "--help"], { timeout: 180000 });
    assert.match(help.combined, /Helix Heal/);
    assert.match(help.combined, /helix-heal analyze/);
  });

  await section("local CLI smoke and missing input diagnostics", async () => {
    const help = run("node", [cliPath, "--help"]);
    assert.match(help.combined, /Helix Heal/);

    const doctor = run("node", [
      cliPath,
      "doctor",
      "--report",
      path.join(fixturesRoot, "playwright-report.json"),
      "--trace",
      path.join(fixturesRoot, "real-trace"),
      "--source-root",
      exampleRoot
    ]);
    assert.match(doctor.combined, /Helix Heal doctor/);

    const missing = run("node", [cliPath, "analyze", "--report", "missing-report.json"], {
      cwd: tmpRoot,
      expectFailure: true
    });
    assert.match(missing.combined, /ENOENT|no such file|cannot find/i);
  });

  await section("artifact ingestion coverage", async () => {
    const { ingestPlaywrightJsonReport } = await loadIngest();

    const flatFailures = await ingestPlaywrightJsonReport(path.join(fixturesRoot, "playwright-report.json"));
    assert.equal(flatFailures.length, 1);
    assert.equal(flatFailures[0].failedSelector, 'getByText("Sign in")');

    const nestedFailures = await ingestPlaywrightJsonReport(path.join(fixturesRoot, "nested-report.json"));
    assert.equal(nestedFailures.length, 2);
    assert.equal(nestedFailures[0].retry, 1);
    assert.match(nestedFailures[0].tracePath, /trace\.zip/);

    const nonSelectorReport = path.join(tmpRoot, "non-selector-report.json");
    writeJson(nonSelectorReport, makeReport("tests/api.spec.ts", "api returns 200", "Expected 200, received 500"));
    const nonSelectorFailures = await ingestPlaywrightJsonReport(nonSelectorReport);
    assert.equal(nonSelectorFailures.length, 1);
    assert.equal(nonSelectorFailures[0].failedSelector, undefined);

    const noTrace = run("node", [
      cliPath,
      "analyze",
      "--report",
      path.join(fixturesRoot, "playwright-report.json"),
      "--output",
      path.join(tmpRoot, "no-trace.md")
    ]);
    assert.match(noTrace.combined, /Helix Heal found 1 selector-related failure/);

    const missingTrace = run("node", [
      cliPath,
      "analyze",
      "--report",
      path.join(fixturesRoot, "playwright-report.json"),
      "--trace",
      path.join(tmpRoot, "missing-trace"),
      "--output",
      path.join(tmpRoot, "missing-trace.md")
    ]);
    assert.match(missingTrace.combined, /Trace context skipped/);

    const corruptTracePath = path.join(tmpRoot, "bad.trace");
    fs.writeFileSync(corruptTracePath, "{ not valid trace json");
    const corruptTrace = run("node", [
      cliPath,
      "analyze",
      "--report",
      path.join(fixturesRoot, "playwright-report.json"),
      "--trace",
      corruptTracePath,
      "--output",
      path.join(tmpRoot, "corrupt-trace.md")
    ]);
    assert.match(corruptTrace.combined, /Helix Heal found 1 selector-related failure/);
  });

  await section("locator quality, confidence gates, and selector-only scope", async () => {
    const { analyzeFailures, defaultConfig } = await loadCore();

    const result = analyzeFailures({
      config: defaultConfig,
      failures: [
        {
          testTitle: "user can sign in",
          testFile: "tests/login.spec.ts",
          errorMessage: 'TimeoutError: waiting for getByText("Sign in")',
          failedSelector: 'getByText("Sign in")',
          action: "click",
          traceContext: {
            tracePath: "inline",
            actions: [],
            domSnapshots: [
              {
                source: "snapshot",
                html: [
                  '<button hidden data-testid="hidden-login">Log in</button>',
                  '<button disabled data-testid="disabled-login">Log in</button>',
                  '<button aria-label="Log in" data-testid="login-submit">Log in</button>'
                ].join("")
              }
            ],
            accessibilityNodes: [{ role: "button", name: "Log in", selector: 'button[data-testid="login-submit"]' }]
          }
        }
      ]
    });

    const suggestion = result.suggestions[0];
    assert.ok(suggestion.recommended);
    assert.ok(suggestion.recommended.confidence >= 0.75);
    assert.ok(suggestion.candidates.some((candidate) => candidate.locator.includes("getByRole")));
    assert.ok(suggestion.candidates.some((candidate) => candidate.locator.includes("getByTestId")));
    assert.ok(!suggestion.candidates.some((candidate) => candidate.locator.includes("hidden-login")));
    assert.ok(!suggestion.candidates.some((candidate) => candidate.locator.includes("disabled-login")));
    assert.ok(!suggestion.candidates.some((candidate) => candidate.locator.includes("nth-child")));
    assert.ok(suggestion.recommended.reasons.length > 0);

    const ambiguous = analyzeFailures({
      config: defaultConfig,
      failures: [
        {
          testTitle: "duplicate buttons",
          testFile: "tests/ambiguous.spec.ts",
          errorMessage: 'strict mode violation: getByRole("button", { name: "Save" }) resolved to 2 elements',
          failedSelector: 'getByRole("button", { name: "Save" })',
          action: "click",
          traceContext: {
            tracePath: "inline",
            actions: [],
            domSnapshots: [{ source: "snapshot", html: "<button>Save</button><button>Save</button>" }],
            accessibilityNodes: [
              { role: "button", name: "Save", selector: "button:nth-of-type(1)" },
              { role: "button", name: "Save", selector: "button:nth-of-type(2)" }
            ]
          }
        }
      ]
    });
    assert.ok(!ambiguous.suggestions[0].recommended);
    assert.ok(ambiguous.suggestions[0].candidates.every((candidate) => candidate.confidence < 0.75));

    const noTrace = analyzeFailures({
      config: defaultConfig,
      failures: [
        {
          testTitle: "user can sign in",
          testFile: "tests/login.spec.ts",
          errorMessage: 'TimeoutError: waiting for getByText("Sign in")',
          failedSelector: 'getByText("Sign in")',
          action: "click"
        }
      ]
    });
    assert.ok(noTrace.suggestions[0].recommended.confidence < 0.9);

    const unsupported = analyzeFailures({
      config: defaultConfig,
      failures: [{ testTitle: "api returns 200", testFile: "tests/api.spec.ts", errorMessage: "Expected 200, received 500" }]
    });
    assert.equal(unsupported.suggestions.length, 0);
    assert.equal(unsupported.unsupported.length, 1);
  });

  await section("failing fixture walkthrough, dry-run patch, and rerun green", async () => {
    const project = copyExampleProject("walkthrough");
    const specPath = path.join(project, "tests", "login.spec.ts");

    const failed = run("npx", ["playwright", "test", "tests/login.spec.ts", "--config", path.join(project, "playwright.config.ts")], {
      cwd: repoRoot,
      expectFailure: true,
      timeout: 180000
    });
    assert.match(failed.combined, /getByText\("Sign in"\)|Sign in/);

    const reportPath = path.join(tmpRoot, "walkthrough-report.md");
    const analysis = run("node", [
      cliPath,
      "analyze",
      "--report",
      path.join(fixturesRoot, "playwright-report.json"),
      "--trace",
      path.join(fixturesRoot, "real-trace"),
      "--source-root",
      project,
      "--output",
      reportPath
    ]);
    assert.match(analysis.combined, /Helix Heal found 1 selector-related failure/);
    assert.match(fs.readFileSync(reportPath, "utf8"), /login-submit|Log in/);

    const before = fs.readFileSync(specPath, "utf8");
    const patchPath = path.join(tmpRoot, "walkthrough.patch");
    const patch = run("node", [
      cliPath,
      "patch",
      "--dry-run",
      "--report",
      path.join(fixturesRoot, "playwright-report.json"),
      "--trace",
      path.join(fixturesRoot, "real-trace"),
      "--source-root",
      project,
      "--output",
      patchPath
    ]);
    assert.match(patch.combined, /getByTestId\("login-submit"\)|getByRole\("button"/);
    assert.equal(fs.readFileSync(specPath, "utf8"), before, "--dry-run changed source file");

    applySingleLineUnifiedPatch(patchPath, specPath);
    const green = run("npx", ["playwright", "test", "tests/login.spec.ts", "--config", path.join(project, "playwright.config.ts")], {
      cwd: repoRoot,
      timeout: 180000
    });
    assert.match(green.combined, /1 passed|passed/);
  });

  await section("cache behavior and no-cache mode", async () => {
    const project = copyExampleProject("cache");
    const report = path.join(fixturesRoot, "playwright-report.json");
    const trace = path.join(fixturesRoot, "real-trace");
    const cachePath = path.join(tmpRoot, "cache", ".helix", "heal-cache.json");
    const cacheCwd = path.dirname(path.dirname(cachePath));
    fs.mkdirSync(cacheCwd, { recursive: true });

    run("node", [
      cliPath,
      "analyze",
      "--report",
      report,
      "--trace",
      trace,
      "--source-root",
      project,
      "--output",
      path.join(cacheCwd, "first.md")
    ], { cwd: cacheCwd });
    assert.ok(fs.existsSync(cachePath), "first run did not write cache");
    const cache = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    assert.ok(cache.entries.length > 0);

    const second = run("node", [
      cliPath,
      "analyze",
      "--report",
      report,
      "--trace",
      trace,
      "--source-root",
      project,
      "--output",
      path.join(cacheCwd, "second.md")
    ], { cwd: cacheCwd });
    assert.match(second.combined, /heal cache match|cached repair/i);

    const noCacheCwd = path.join(tmpRoot, "no-cache");
    fs.mkdirSync(noCacheCwd, { recursive: true });
    run("node", [
      cliPath,
      "analyze",
      "--report",
      report,
      "--trace",
      trace,
      "--source-root",
      project,
      "--no-cache",
      "--output",
      path.join(noCacheCwd, "report.md")
    ], { cwd: noCacheCwd });
    assert.equal(fs.existsSync(path.join(noCacheCwd, ".helix", "heal-cache.json")), false);

    const badCacheDir = path.join(tmpRoot, "bad-cache", ".helix");
    fs.mkdirSync(badCacheDir, { recursive: true });
    fs.writeFileSync(path.join(badCacheDir, "heal-cache.json"), "{ bad json");
    const malformed = run("node", [
      cliPath,
      "analyze",
      "--report",
      report,
      "--trace",
      trace,
      "--source-root",
      project,
      "--output",
      path.join(tmpRoot, "bad-cache", "report.md")
    ], { cwd: path.dirname(badCacheDir) });
    assert.match(malformed.combined, /Heal cache ignored/);
  });

  await section("static and live validation", async () => {
    const staticReport = path.join(tmpRoot, "static-validation.md");
    run("node", [
      cliPath,
      "analyze",
      "--report",
      path.join(fixturesRoot, "playwright-report.json"),
      "--trace",
      path.join(fixturesRoot, "real-trace"),
      "--source-root",
      exampleRoot,
      "--no-cache",
      "--output",
      staticReport
    ]);
    assert.match(fs.readFileSync(staticReport, "utf8"), /candidate resolves to one trace-backed element/);

    const liveReport = path.join(tmpRoot, "live-validation.md");
    run("node", [
      cliPath,
      "analyze",
      "--report",
      path.join(fixturesRoot, "playwright-report.json"),
      "--trace",
      path.join(fixturesRoot, "real-trace"),
      "--source-root",
      exampleRoot,
      "--no-cache",
      "--live-url",
      `file://${path.join(exampleRoot, "live", "login.html").replace(/\\/g, "/")}`,
      "--output",
      liveReport
    ], { timeout: 180000 });
    assert.match(fs.readFileSync(liveReport, "utf8"), /live locator resolves uniquely and is actionable/);

    const unreachable = run("node", [
      cliPath,
      "analyze",
      "--report",
      path.join(fixturesRoot, "playwright-report.json"),
      "--trace",
      path.join(fixturesRoot, "real-trace"),
      "--source-root",
      exampleRoot,
      "--no-cache",
      "--live-url",
      "http://127.0.0.1:9",
      "--output",
      path.join(tmpRoot, "unreachable-live.md")
    ]);
    assert.match(unreachable.combined, /Live validation skipped/);
  });

  await section("GitHub Action local artifact flow", async () => {
    const actionCwd = copyExampleProject("action");
    run("node", [actionPath], {
      cwd: actionCwd,
      env: {
        HELIX_PLAYWRIGHT_REPORT: path.join(fixturesRoot, "playwright-report.json"),
        HELIX_TRACE: path.join(fixturesRoot, "real-trace"),
        HELIX_SOURCE_ROOT: actionCwd
      }
    });
    for (const file of ["helix-heal-report.md", "helix-heal.patch", "helix-heal-dashboard.html"]) {
      assert.ok(fs.existsSync(path.join(actionCwd, file)), `${file} was not written`);
    }
    const commentSafeReport = fs.readFileSync(path.join(actionCwd, "helix-heal-report.md"), "utf8");
    assert.doesNotMatch(commentSafeReport, /SECRET|TOKEN|PASSWORD/);
  });

  await section("local-first source privacy scan", async () => {
    const scannedFiles = [
      path.join(repoRoot, "packages", "cli", "src", "index.ts"),
      path.join(repoRoot, "packages", "core", "src", "analyze.ts"),
      path.join(repoRoot, "packages", "core", "src", "reporter.ts"),
      path.join(repoRoot, "packages", "github-action", "src", "index.ts")
    ];
    const combined = scannedFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
    assert.doesNotMatch(combined, /\bfetch\s*\(/);
    assert.doesNotMatch(combined, /https?\.request/);
    assert.doesNotMatch(combined, /api\.openai|anthropic|litellm|posthog|segment/i);
  });

  await section("dashboard output and scale smoke", async () => {
    const dashboardPath = path.join(tmpRoot, "helix-dashboard.html");
    run("node", [
      cliPath,
      "dashboard",
      "--report",
      path.join(fixturesRoot, "playwright-report.json"),
      "--trace",
      path.join(fixturesRoot, "real-trace"),
      "--source-root",
      exampleRoot,
      "--output",
      dashboardPath
    ]);
    const dashboard = fs.readFileSync(dashboardPath, "utf8");
    assert.match(dashboard, /Helix Heal Dashboard/);
    assert.match(dashboard, /Recommendations/);

    const failures = Array.from({ length: 100 }, (_, index) => ({
      testTitle: `button ${index}`,
      testFile: "tests/login.spec.ts",
      errorMessage: 'TimeoutError: waiting for getByText("Sign in")',
      failedSelector: 'getByText("Sign in")',
      action: "click",
      traceContext: {
        tracePath: "scale",
        actions: [],
        domSnapshots: [{ source: "snapshot", html: '<button aria-label="Log in" data-testid="login-submit">Log in</button>' }],
        accessibilityNodes: [{ role: "button", name: "Log in", selector: 'button[data-testid="login-submit"]' }]
      }
    }));
    const { analyzeFailures, defaultConfig } = await loadCore();
    const started = Date.now();
    const result = analyzeFailures({ failures, config: defaultConfig });
    assert.equal(result.suggestions.length, 100);
    assert.ok(Date.now() - started < 30000);
  });

  const summaryPath = path.join(repoRoot, ".helix", "product-readiness-e2e.json");
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(summaryPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`);
  console.log(`\nProduct readiness E2E summary written to ${summaryPath}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  })
  .finally(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });
