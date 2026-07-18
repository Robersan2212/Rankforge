import { ResearchError } from "../errors.js";
import type { ResearchResult } from "./demo.js";

/**
 * Placeholder for a paid keyword API (DataForSEO / SEMrush / Ahrefs).
 * Requires KEYWORD_RESEARCH_API_KEY — not silently fabricated.
 */
export async function realRelatedKeywords(
  seed: string,
  limit: number
): Promise<ResearchResult> {
  const apiKey = process.env.KEYWORD_RESEARCH_API_KEY?.trim();
  if (!apiKey) {
    throw new ResearchError(
      "CONFIG_ERROR",
      "KEYWORD_RESEARCH_PROVIDER=real requires KEYWORD_RESEARCH_API_KEY. Use provider=demo for local demos.",
      503
    );
  }

  // Real provider wiring is intentionally left for when a paid key is available.
  // Do not invent keywords here.
  void seed;
  void limit;
  throw new ResearchError(
    "NOT_IMPLEMENTED",
    "Real keyword research provider is not configured for a live API yet. Set KEYWORD_RESEARCH_PROVIDER=demo.",
    501
  );
}
