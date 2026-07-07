export interface KeywordUsage {
  keyword: string;
  count: number;
  isPrimary: boolean;
}

export interface KeywordUsageResult {
  primary: KeywordUsage | null;
  semantic: KeywordUsage[];
  totalOccurrences: number;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countOccurrences(text: string, keyword: string): number {
  const trimmed = keyword.trim();
  if (!trimmed) return 0;

  const pattern = new RegExp(`\\b${escapeRegex(trimmed)}\\b`, "gi");
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

export function countKeywordUsage(
  text: string,
  primaryKeyword: string,
  semanticKeywords: string[] = []
): KeywordUsageResult {
  const primaryTrimmed = primaryKeyword.trim();
  const primary: KeywordUsage | null = primaryTrimmed
    ? {
        keyword: primaryTrimmed,
        count: countOccurrences(text, primaryTrimmed),
        isPrimary: true,
      }
    : null;

  const seen = new Set<string>();
  const semantic: KeywordUsage[] = [];

  for (const kw of semanticKeywords) {
    const trimmed = kw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    if (primaryTrimmed && key === primaryTrimmed.toLowerCase()) continue;
    seen.add(key);
    semantic.push({
      keyword: trimmed,
      count: countOccurrences(text, trimmed),
      isPrimary: false,
    });
  }

  const totalOccurrences =
    (primary?.count ?? 0) +
    semantic.reduce((sum, item) => sum + item.count, 0);

  return { primary, semantic, totalOccurrences };
}
