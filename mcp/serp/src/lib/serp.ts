import { SerpError } from "./errors.js";

export interface SerpOrganicResult {
  url: string;
  rank_position: number;
  title: string;
  snippet: string;
}

export interface SerpResponse {
  keyword: string;
  results: SerpOrganicResult[];
}

function mapApiError(status: number, message: string): never {
  const lower = message.toLowerCase();
  if (status === 401 || lower.includes("invalid api key")) {
    throw new SerpError("SERP_INVALID_KEY", message, 401);
  }
  if (status === 429 || lower.includes("rate limit")) {
    throw new SerpError("SERP_RATE_LIMITED", message, 429);
  }
  throw new SerpError("SERP_API_ERROR", message, status >= 400 ? status : 502);
}

export async function getTopResults(
  keyword: string,
  count = 10
): Promise<SerpResponse> {
  const trimmed = keyword.trim();
  if (!trimmed) {
    throw new SerpError("INVALID_KEYWORD", "keyword is required", 400);
  }

  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    throw new SerpError(
      "SERP_INVALID_KEY",
      "SERP_API_KEY is not set. Add a SerpAPI key to fetch live SERP results.",
      401
    );
  }

  const limit = Math.min(Math.max(1, count), 10);
  const params = new URLSearchParams({
    engine: "google",
    q: trimmed,
    api_key: apiKey,
    num: String(limit),
  });

  const response = await fetch(
    `https://serpapi.com/search.json?${params.toString()}`
  );

  const data = (await response.json()) as {
    organic_results?: Array<{
      position?: number;
      title?: string;
      link?: string;
      snippet?: string;
    }>;
    error?: string;
  };

  if (!response.ok) {
    mapApiError(response.status, data.error ?? `HTTP ${response.status}`);
  }

  if (data.error) {
    mapApiError(502, data.error);
  }

  const organic = data.organic_results ?? [];
  if (organic.length === 0) {
    throw new SerpError(
      "SERP_NO_RESULTS",
      `No organic results found for keyword: ${trimmed}`,
      404
    );
  }

  const results = organic.slice(0, limit).map((row, index) => ({
    rank_position: row.position ?? index + 1,
    title: row.title ?? "",
    url: row.link ?? "",
    snippet: row.snippet ?? "",
  }));

  return { keyword: trimmed, results };
}

/** @deprecated Use getTopResults */
export async function fetchSerp(keyword: string): Promise<
  Array<{ position: number; title: string; link: string; snippet: string }>
> {
  const { results } = await getTopResults(keyword);
  return results.map((r) => ({
    position: r.rank_position,
    title: r.title,
    link: r.url,
    snippet: r.snippet,
  }));
}
