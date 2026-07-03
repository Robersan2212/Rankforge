import * as cheerio from "cheerio";
import type { HeadingsByLevel, ParsedPageData } from "./types.js";

export function normalizeDomain(netloc: string): string {
  let host = netloc.toLowerCase();
  if (host.startsWith("www.")) host = host.slice(4);
  return host;
}

function isInternalLink(
  href: string,
  pageUrl: string,
  pageDomain: string
): boolean | null {
  if (!href || /^#|javascript:|mailto:|tel:/i.test(href)) return null;
  try {
    const parsed = new URL(href, pageUrl);
    if (!["http:", "https:", ""].includes(parsed.protocol)) return null;
    if (!parsed.hostname) return true;
    return normalizeDomain(parsed.hostname) === pageDomain;
  } catch {
    return null;
  }
}

function visibleWordCount($: cheerio.CheerioAPI): number {
  const clone = cheerio.load($.html());
  clone("script, style, noscript").remove();
  clone("nav, footer, header[role='banner']").remove();
  const text = clone.root().text().replace(/\s+/g, " ").trim();
  const words = text.match(/\b[\w'-]+\b/gu);
  return words ? words.length : 0;
}

function emptyHeadings(): HeadingsByLevel {
  return { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] };
}

function extractHeadings($: cheerio.CheerioAPI): HeadingsByLevel {
  const headings = emptyHeadings();
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const tag = el.tagName?.toLowerCase();
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (tag && text && tag in headings) {
      headings[tag as keyof HeadingsByLevel].push(text);
    }
  });
  return headings;
}

export function headingLevelsInOrder($: cheerio.CheerioAPI): number[] {
  const levels: number[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const m = el.tagName?.match(/^h(\d)$/i);
    if (m) levels.push(parseInt(m[1], 10));
  });
  return levels;
}

export function logicalHierarchyOk(levels: number[]): boolean {
  if (levels.length === 0) return true;
  let prev = 0;
  for (const level of levels) {
    if (level > prev + 1 && prev !== 0) return false;
    prev = Math.max(prev, level);
  }
  return true;
}

function countLinks(
  $: cheerio.CheerioAPI,
  pageUrl: string,
  pageDomain: string
) {
  let internal_count = 0;
  let external_count = 0;
  const seen = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim() ?? "";
    let key: string;
    try {
      key = new URL(href, pageUrl).href;
    } catch {
      return;
    }
    if (seen.has(key)) return;
    const classification = isInternalLink(href, pageUrl, pageDomain);
    if (classification === null) return;
    seen.add(key);
    if (classification) internal_count++;
    else external_count++;
  });
  return { internal_count, external_count };
}

function countImages($: cheerio.CheerioAPI) {
  const images = $("img");
  const total = images.length;
  let missing_alt_count = 0;
  const missing_alt_examples: string[] = [];

  images.each((_, el) => {
    if (!$(el).attr("alt")?.trim()) {
      missing_alt_count++;
      if (missing_alt_examples.length < 5) {
        const src = $(el).attr("src")?.trim() || "(no src)";
        missing_alt_examples.push(src);
      }
    }
  });

  return { total, missing_alt_count, missing_alt_examples };
}

export function parseHtml(html: string, pageUrl: string): ParsedPageData {
  const $ = cheerio.load(html);
  const parsed = new URL(pageUrl);
  const pageDomain = normalizeDomain(parsed.hostname);

  const title = $("title").first().text().replace(/\s+/g, " ").trim();
  const desc =
    $('meta[name="description"]').attr("content")?.trim() ??
    $('meta[name="Description"]').attr("content")?.trim() ??
    "";

  const headings = extractHeadings($);

  return {
    meta_title: title || null,
    meta_title_length: title.length,
    meta_description: desc || null,
    meta_description_length: desc.length,
    headings,
    heading_levels_in_order: headingLevelsInOrder($),
    word_count: visibleWordCount($),
    links: countLinks($, pageUrl, pageDomain),
    images: countImages($),
  };
}
