import type { CandidateLocator, HelixConfig, NormalizedFailure } from "./types.js";

export function generateCandidates(
  failure: NormalizedFailure,
  config: HelixConfig
): CandidateLocator[] {
  const inferredName = inferHumanName(failure.failedSelector ?? failure.errorMessage);

  if (!inferredName) {
    return [];
  }

  const candidates: CandidateLocator[] = [];

  if (config.preferredLocators.includes("role")) {
    candidates.push({
      locator: `page.getByRole("button", { name: ${JSON.stringify(inferredName)} })`,
      strategy: "role",
      source: "deterministic",
      evidence: ["inferred accessible name from failed locator text"]
    });
  }

  if (config.preferredLocators.includes("text")) {
    candidates.push({
      locator: `page.getByText(${JSON.stringify(inferredName)})`,
      strategy: "text",
      source: "deterministic",
      evidence: ["fallback text locator candidate"]
    });
  }

  return candidates;
}

function inferHumanName(value: string): string | undefined {
  const quoted = value.match(/["'`]([^"'`]{2,80})["'`]/);
  if (quoted?.[1]) {
    return quoted[1].trim();
  }

  return undefined;
}

