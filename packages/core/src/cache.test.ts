import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { analyzeFailures } from "./analyze.js";
import { defaultConfig } from "./config.js";
import {
  applyHealCache,
  readHealCache,
  updateHealCacheFromResult,
  writeHealCache
} from "./cache.js";

describe("heal cache", () => {
  it("stores and reuses validated healing suggestions for unchanged files", async () => {
    const root = await mkdtemp(join(tmpdir(), "helix-cache-"));
    await mkdir(join(root, "tests"));
    await writeFile(
      join(root, "tests/login.spec.ts"),
      'await page.getByText("Sign in").click();\n',
      "utf8"
    );

    const result = analyzeFailures({
      config: defaultConfig,
      failures: [
        {
          testTitle: "login",
          testFile: "tests/login.spec.ts",
          errorMessage: 'waiting for getByText("Sign in")',
          failedSelector: 'getByText("Sign in")',
          action: "click",
          traceContext: {
            tracePath: "trace",
            actions: [],
            domSnapshots: [
              {
                source: "snapshot",
                html: '<button data-testid="login-submit">Log in</button>'
              }
            ],
            accessibilityNodes: []
          }
        }
      ]
    });

    const cachePath = join(root, ".helix/heal-cache.json");
    const cache = await updateHealCacheFromResult({ version: 1, entries: [] }, result, root);
    await writeHealCache(cachePath, cache);
    const restored = await readHealCache(cachePath);

    const secondResult = analyzeFailures({
      config: defaultConfig,
      failures: [
        {
          testTitle: "login",
          testFile: "tests/login.spec.ts",
          errorMessage: 'waiting for getByText("Sign in")',
          failedSelector: 'getByText("Sign in")',
          action: "click"
        }
      ]
    });
    await applyHealCache(secondResult, restored, root, defaultConfig);

    expect(JSON.parse(await readFile(cachePath, "utf8")).entries).toHaveLength(1);
    expect(secondResult.suggestions[0]?.recommended?.source).toBe("cache");
  });
});
