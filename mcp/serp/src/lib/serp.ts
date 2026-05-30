export interface SerpOrganicResult {
  position: number;
  title: string;
  link: string;
  snippet: string;
}

export async function fetchSerp(keyword: string): Promise<SerpOrganicResult[]> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    throw new Error(
      "SERP_API_KEY is not set. Add a SerpAPI key to fetch live SERP results."
    );
  }

  const params = new URLSearchParams({
    engine: "google",
    q: keyword,
    api_key: apiKey,
    num: "10",
  });

  const response = await fetch(
    `https://serpapi.com/search.json?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`SERP API error: HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    organic_results?: Array<{
      position?: number;
      title?: string;
      link?: string;
      snippet?: string;
    }>;
    error?: string;
  };

  if (data.error) {
    throw new Error(data.error);
  }

  const organic = data.organic_results ?? [];
  return organic.slice(0, 10).map((row, index) => ({
    position: row.position ?? index + 1,
    title: row.title ?? "",
    link: row.link ?? "",
    snippet: row.snippet ?? "",
  }));
}
