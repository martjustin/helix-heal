import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { rankCandidates } from "./ranker.js";
import type { AnalyzeResult, CandidateLocator, HelixConfig, RankedLocator } from "./types.js";

export type HealCacheEntry = {
  testFile: string;
  fileHash: string;
  originalSelector: string;
  replacementSelector: string;
  confidence: number;
  validationStatus?: string;
  timestamp: string;
};

export type HealCache = {
  version: 1;
  entries: HealCacheEntry[];
};

export async function readHealCache(cachePath: string): Promise<HealCache> {
  let raw: string;
  try {
    raw = await readFile(cachePath, "utf8");
  } catch {
    return { version: 1, entries: [] };
  }

  try {
    const parsed = JSON.parse(raw) as HealCache;
    return {
      version: 1,
      entries: Array.isArray(parsed.entries) ? parsed.entries : []
    };
  } catch (error) {
    console.warn(
      `Heal cache ignored: ${cachePath} is not valid JSON (${error instanceof Error ? error.message : String(error)})`
    );
    return { version: 1, entries: [] };
  }
}

export async function writeHealCache(cachePath: string, cache: HealCache): Promise<void> {
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

export async function applyHealCache(
  result: AnalyzeResult,
  cache: HealCache,
  sourceRoot: string,
  config: HelixConfig
): Promise<AnalyzeResult> {
  for (const suggestion of result.suggestions) {
    const failedSelector = suggestion.failure.failedSelector;
    if (!failedSelector) {
      continue;
    }

    const fileHash = await hashSourceFile(sourceRoot, suggestion.failure.testFile);
    if (!fileHash) {
      continue;
    }

    const entry = cache.entries.find(
      (candidate) =>
        candidate.testFile === suggestion.failure.testFile &&
        candidate.fileHash === fileHash &&
        candidate.originalSelector === failedSelector
    );

    if (!entry) {
      continue;
    }

    const cachedCandidate: CandidateLocator = {
      locator: entry.replacementSelector,
      strategy: inferStrategy(entry.replacementSelector),
      source: "cache",
      evidence: ["heal cache match for unchanged source file"],
      validation: {
        status: "passed",
        mode: "static",
        matchCount: 1,
        reasons: ["cached repair was previously validated"]
      }
    };

    const merged = [cachedCandidate, ...suggestion.candidates].filter(
      (candidate, index, all) =>
        all.findIndex((other) => other.locator === candidate.locator) === index
    );
    suggestion.candidates = rankCandidates(merged, config);
    suggestion.recommended = suggestion.candidates.find(
      (candidate) => candidate.confidence >= config.minSuggestionConfidence
    );
  }

  return result;
}

export async function updateHealCacheFromResult(
  cache: HealCache,
  result: AnalyzeResult,
  sourceRoot: string
): Promise<HealCache> {
  const nextEntries = [...cache.entries];

  for (const suggestion of result.suggestions) {
    const recommended = suggestion.recommended;
    const failedSelector = suggestion.failure.failedSelector;

    if (!recommended || !failedSelector || recommended.validation?.status === "failed") {
      continue;
    }

    const fileHash = await hashSourceFile(sourceRoot, suggestion.failure.testFile);
    if (!fileHash) {
      continue;
    }

    const entry: HealCacheEntry = {
      testFile: suggestion.failure.testFile,
      fileHash,
      originalSelector: failedSelector,
      replacementSelector: recommended.locator,
      confidence: recommended.confidence,
      validationStatus: recommended.validation?.status,
      timestamp: new Date().toISOString()
    };
    const existingIndex = nextEntries.findIndex(
      (candidate) =>
        candidate.testFile === entry.testFile &&
        candidate.fileHash === entry.fileHash &&
        candidate.originalSelector === entry.originalSelector
    );

    if (existingIndex >= 0) {
      nextEntries[existingIndex] = entry;
    } else {
      nextEntries.push(entry);
    }
  }

  return {
    version: 1,
    entries: nextEntries
  };
}

async function hashSourceFile(sourceRoot: string, testFile: string): Promise<string | undefined> {
  try {
    const source = await readFile(resolve(sourceRoot, testFile));
    return createHash("sha256").update(source).digest("hex");
  } catch {
    return undefined;
  }
}

function inferStrategy(locator: string): RankedLocator["strategy"] {
  if (locator.includes("getByRole")) return "role";
  if (locator.includes("getByTestId")) return "testId";
  if (locator.includes("getByLabel")) return "label";
  if (locator.includes("getByText")) return "text";
  if (locator.includes("locator")) return "css";
  return "unknown";
}
