import * as cheerio from "cheerio";

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "with", "by", "from", "as", "is", "was", "are", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could", "should",
  "may", "might", "must", "shall", "can", "need", "your", "you", "our", "we",
  "they", "their", "this", "that", "these", "those", "it", "its", "how", "what",
  "when", "where", "why", "who", "which", "all", "each", "every", "both", "few",
  "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own",
  "same", "so", "than", "too", "very", "just", "also", "into", "over", "after",
  "before", "between", "through", "during", "about", "against", "up", "down",
  "out", "off", "then", "once", "here", "there", "any", "get", "use", "using",
  "make", "made", "new", "best", "top", "guide", "tips", "learn", "read",
]);

function normalizePhrase(phrase: string): string {
  return phrase.toLowerCase().replace(/\s+/g, " ").trim();
}

function isValidTopic(phrase: string): boolean {
  const normalized = normalizePhrase(phrase);
  if (normalized.length < 3 || normalized.length > 80) return false;
  const words = normalized.split(/\s+/);
  if (words.length > 6) return false;
  const meaningful = words.filter((w) => !STOP_WORDS.has(w) && w.length > 2);
  return meaningful.length >= 1;
}

function extractPhrasesFromText(text: string): string[] {
  const phrases: string[] = [];
  const segments = text
    .split(/[.!?:;|•\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const segment of segments) {
    if (isValidTopic(segment)) {
      phrases.push(normalizePhrase(segment));
    }
    const commaParts = segment.split(/,\s*/);
    for (const part of commaParts) {
      const trimmed = part.trim();
      if (isValidTopic(trimmed)) {
        phrases.push(normalizePhrase(trimmed));
      }
    }
  }

  return phrases;
}

export function extractTopics(
  headings: { h2: string[]; h3: string[] },
  bodySample: string,
  maxTopics = 30
): string[] {
  const candidates: string[] = [];

  for (const h of [...headings.h2, ...headings.h3]) {
    candidates.push(...extractPhrasesFromText(h));
  }
  candidates.push(...extractPhrasesFromText(bodySample));

  const seen = new Set<string>();
  const topics: string[] = [];
  for (const phrase of candidates) {
    if (seen.has(phrase)) continue;
    seen.add(phrase);
    topics.push(phrase);
    if (topics.length >= maxTopics) break;
  }

  return topics;
}

export function extractFaqQuestions(html: string): string[] {
  const $ = cheerio.load(html);
  const questions = new Set<string>();

  $("details summary").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length >= 5 && text.length <= 300) {
      questions.add(text.endsWith("?") ? text : `${text}?`);
    }
  });

  $("h2, h3, h4, h5").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.endsWith("?") && text.length >= 5 && text.length <= 300) {
      questions.add(text);
    }
  });

  const jsonLdScripts = $('script[type="application/ld+json"]');
  jsonLdScripts.each((_, el) => {
    const raw = $(el).html()?.trim();
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as unknown;
      collectFaqFromJsonLd(data, questions);
    } catch {
      // ignore invalid JSON-LD
    }
  });

  return Array.from(questions).slice(0, 20);
}

function collectFaqFromJsonLd(data: unknown, questions: Set<string>): void {
  if (!data) return;

  if (Array.isArray(data)) {
    for (const item of data) {
      collectFaqFromJsonLd(item, questions);
    }
    return;
  }

  if (typeof data !== "object") return;

  const obj = data as Record<string, unknown>;
  const type = obj["@type"];
  const types = Array.isArray(type) ? type : type ? [type] : [];

  if (types.some((t) => String(t).toLowerCase() === "faqpage")) {
    const mainEntity = obj.mainEntity;
    const entities = Array.isArray(mainEntity)
      ? mainEntity
      : mainEntity
        ? [mainEntity]
        : [];
    for (const entity of entities) {
      if (entity && typeof entity === "object") {
        const name = (entity as Record<string, unknown>).name;
        if (typeof name === "string" && name.trim()) {
          const q = name.trim();
          questions.add(q.endsWith("?") ? q : `${q}?`);
        }
      }
    }
  }

  if (obj["@graph"]) {
    collectFaqFromJsonLd(obj["@graph"], questions);
  }
}
