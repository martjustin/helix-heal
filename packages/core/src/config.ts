import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { HelixConfig } from "./types.js";

const configSchema = z.object({
  testIdAttribute: z.string().default("data-testid"),
  minSuggestionConfidence: z.number().min(0).max(1).default(0.75),
  minAutoPatchConfidence: z.number().min(0).max(1).default(0.9),
  allowLLM: z.boolean().default(false),
  preferredLocators: z
    .array(z.enum(["role", "label", "testId", "text"]))
    .default(["role", "label", "testId", "text"]),
  excludePaths: z.array(z.string()).default(["node_modules", "dist", "build"])
});

export const defaultConfig: HelixConfig = configSchema.parse({});

export async function loadConfig(cwd: string): Promise<HelixConfig> {
  const path = join(cwd, ".helix", "config.json");

  try {
    const raw = await readFile(path, "utf8");
    return configSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (isMissingFile(error)) {
      return defaultConfig;
    }

    throw error;
  }
}

function isMissingFile(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
  );
}

