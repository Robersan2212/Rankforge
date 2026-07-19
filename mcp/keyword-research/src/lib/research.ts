import { ResearchError } from "./errors.js";
import { demoRelatedKeywords, type ResearchResult } from "./providers/demo.js";
import { realRelatedKeywords } from "./providers/real.js";

export async function getRelatedKeywords(
  seed: string,
  limit = 50
): Promise<ResearchResult> {
  const trimmed = seed.trim();
  if (trimmed.length < 2) {
    throw new ResearchError(
      "INVALID_SEED",
      "seed must be at least 2 characters",
      400
    );
  }
  if (trimmed.length > 100) {
    throw new ResearchError(
      "INVALID_SEED",
      "seed must be at most 100 characters",
      400
    );
  }

  const capped = Math.max(20, Math.min(50, Math.floor(limit) || 50));
  const provider = (process.env.KEYWORD_RESEARCH_PROVIDER || "demo")
    .trim()
    .toLowerCase();

  if (provider === "real") {
    return realRelatedKeywords(trimmed, capped);
  }

  if (provider !== "demo") {
    throw new ResearchError(
      "CONFIG_ERROR",
      `Unknown KEYWORD_RESEARCH_PROVIDER: ${provider}`,
      500
    );
  }

  return {
    seed: trimmed,
    provider: "demo",
    keywords: demoRelatedKeywords(trimmed, capped),
  };
}
