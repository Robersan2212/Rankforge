import * as cheerio from "cheerio";
import type { HeadingsByLevel } from "./types.js";

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

export function visibleWordCount($: cheerio.CheerioAPI): number {
  const clone = cheerio.load($.html());
  clone("script, style, noscript").remove();
  clone("nav, footer, header[role='banner']").remove();
  const text = clone.root().text().replace(/\s+/g, " ").trim();
  const words = text.match(/\b[\w'-]+\b/gu);
  return words ? words.length : 0;
}

export function bodyTextSample($: cheerio.CheerioAPI, maxWords = 500): string {
  const clone = cheerio.load($.html());
  clone("script, style, noscript, nav, footer, header").remove();
  const text = clone("main, article, [role='main'], body")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();
  const words = text.match(/\b[\w'-]+\b/gu) ?? [];
  return words.slice(0, maxWords).join(" ");
}

export function parseHtml(html: string): {
  headings: HeadingsByLevel;
  word_count: number;
  body_sample: string;
} {
  const $ = cheerio.load(html);
  return {
    headings: extractHeadings($),
    word_count: visibleWordCount($),
    body_sample: bodyTextSample($),
  };
}
