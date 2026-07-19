export interface RelatedKeyword {
  keyword: string;
  searchVolume: number;
  difficulty: number;
}

export interface ResearchResult {
  seed: string;
  provider: string;
  keywords: RelatedKeyword[];
}

/** Deterministic demo fixture: ≥20 keywords with volume + difficulty. */
export function demoRelatedKeywords(
  seed: string,
  limit: number
): RelatedKeyword[] {
  const base = seed.trim().toLowerCase() || "seo";
  const templates = [
    `${base} guide`,
    `${base} tips`,
    `${base} strategy`,
    `${base} examples`,
    `${base} best practices`,
    `${base} for beginners`,
    `${base} checklist`,
    `${base} tools`,
    `${base} ideas`,
    `${base} template`,
    `how to ${base}`,
    `${base} vs alternatives`,
    `${base} benefits`,
    `${base} mistakes`,
    `${base} trends`,
    `${base} metrics`,
    `${base} plan`,
    `${base} framework`,
    `${base} software`,
    `${base} services`,
    `${base} course`,
    `${base} agency`,
    `${base} case study`,
    `${base} report`,
    `${base} analysis`,
    `advanced ${base}`,
    `${base} techniques`,
    `${base} workflow`,
    `${base} automation`,
    `${base} kpi`,
  ];

  const capped = Math.max(1, Math.min(limit, templates.length));
  return templates.slice(0, capped).map((keyword, index) => ({
    keyword,
    searchVolume: 2400 - index * 70,
    difficulty: Math.min(92, 18 + index * 2),
  }));
}
