import * as cheerio from "cheerio";
import { chromium } from "playwright";

const CRAWL_TIMEOUT_MS = 45_000;

export interface AuditIssue {
  severity: "critical" | "warning" | "info";
  check: string;
  message: string;
  fix: string;
}

export interface AuditResult {
  url: string;
  crawledAt: string;
  metaTitle: string;
  metaDescription: string;
  meta: {
    title: string;
    title_length: number;
    description: string;
    description_length: number;
  };
  headings: { level: string; text: string }[];
  wordCount: number;
  links: { internal: number; external: number };
  images: { total: number; with_alt: number; missing_alt: number };
  headingHierarchyOk: boolean;
  seoScore: number;
  issues: AuditIssue[];
}

function normalizeDomain(netloc: string): string {
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

function extractHeadings($: cheerio.CheerioAPI) {
  const headings: { level: string; text: string }[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const tag = el.tagName?.toLowerCase();
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (tag && text) headings.push({ level: tag, text });
  });
  return headings;
}

function headingLevelsInOrder($: cheerio.CheerioAPI): number[] {
  const levels: number[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const m = el.tagName?.match(/^h(\d)$/i);
    if (m) levels.push(parseInt(m[1], 10));
  });
  return levels;
}

function logicalHierarchyOk(levels: number[]): boolean {
  if (levels.length === 0) return true;
  let prev = 0;
  for (const level of levels) {
    if (level > prev + 1 && prev !== 0) return false;
    prev = Math.max(prev, level);
  }
  return true;
}

function countLinks($: cheerio.CheerioAPI, pageUrl: string, pageDomain: string) {
  let internal = 0;
  let external = 0;
  const seen = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim() ?? "";
    const key = new URL(href, pageUrl).href;
    if (seen.has(key)) return;
    const classification = isInternalLink(href, pageUrl, pageDomain);
    if (classification === null) return;
    seen.add(key);
    if (classification) internal++;
    else external++;
  });
  return { internal, external };
}

function countImages($: cheerio.CheerioAPI) {
  const images = $("img");
  const total = images.length;
  let withAlt = 0;
  images.each((_, el) => {
    if ($(el).attr("alt")?.trim()) withAlt++;
  });
  return { total, with_alt: withAlt, missing_alt: total - withAlt };
}

function scoreAndIssues(data: {
  meta: AuditResult["meta"];
  headings: AuditResult["headings"];
  wordCount: number;
  links: AuditResult["links"];
  images: AuditResult["images"];
  headingHierarchyOk: boolean;
}): { score: number; issues: AuditIssue[] } {
  let score = 0;
  const issues: AuditIssue[] = [];

  const add = (
    severity: AuditIssue["severity"],
    check: string,
    message: string,
    fix: string,
    points: number,
    passed: boolean
  ) => {
    if (passed) score += points;
    else issues.push({ severity, check, message, fix });
  };

  const title = data.meta.title;
  const titleLen = data.meta.title_length;
  const desc = data.meta.description;
  const descLen = data.meta.description_length;
  const h1 = data.headings.filter((h) => h.level === "h1").length;
  const h2 = data.headings.filter((h) => h.level === "h2").length;
  const h3 = data.headings.filter((h) => h.level === "h3").length;

  add(
    "critical",
    "title_exists",
    "Page is missing a <title> tag",
    "Add a unique, descriptive <title> tag in the document <head>.",
    10,
    Boolean(title.trim())
  );
  add(
    title.trim() ? "warning" : "info",
    "title_length",
    `Title is ${titleLen} characters (recommended: 50–60)`,
    "Adjust the title length to 50–60 characters for optimal SERP display.",
    5,
    titleLen >= 50 && titleLen <= 60 && Boolean(title.trim())
  );
  add(
    "critical",
    "meta_description_exists",
    "Page is missing a meta description",
    'Add <meta name="description" content="..."> in the document <head>.',
    10,
    Boolean(desc.trim())
  );
  add(
    desc.trim() ? "warning" : "info",
    "meta_description_length",
    `Meta description is ${descLen} characters (recommended: 150–160)`,
    "Expand or trim the meta description to 150–160 characters.",
    5,
    descLen >= 150 && descLen <= 160 && Boolean(desc.trim())
  );
  add(
    "critical",
    "exactly_one_h1",
    `Page has ${h1} H1 tag(s) (recommended: exactly 1)`,
    "Use exactly one H1 per page that clearly describes the main topic.",
    10,
    h1 === 1
  );
  add(
    "warning",
    "heading_hierarchy",
    "Heading levels skip a rank (e.g. H1 → H3 without H2)",
    "Use a logical heading order without skipping levels (H1 → H2 → H3).",
    10,
    data.headingHierarchyOk
  );
  add(
    "warning",
    "word_count",
    `Page has ${data.wordCount} words (recommended: at least 300)`,
    "Add more substantive content to reach at least 300 visible words.",
    10,
    data.wordCount >= 300
  );
  add(
    "warning",
    "images_alt",
    `${data.images.missing_alt} of ${data.images.total} images are missing alt text`,
    "Add descriptive alt text to all images.",
    10,
    data.images.total === 0 || data.images.missing_alt === 0
  );
  add(
    "info",
    "internal_links",
    "No internal links found on the page",
    "Add internal links to related content.",
    10,
    data.links.internal >= 1
  );
  add(
    "info",
    "external_links",
    "No external links found on the page",
    "Consider linking to authoritative external sources where relevant.",
    5,
    data.links.external >= 1
  );
  add(
    "warning",
    "heading_depth",
    `Page has ${h2} H2(s) and ${h3} H3(s) (recommended: at least 2 H2s and 1 H3)`,
    "Add more H2 and H3 subheadings to structure content.",
    15,
    h2 >= 2 && h3 >= 1
  );

  return { score: Math.min(score, 100), issues };
}

export async function crawlPage(url: string): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: CRAWL_TIMEOUT_MS,
    });
    await page.waitForTimeout(1500);
    if (!response) {
      throw new Error("Page failed to load: no response received");
    }
    if (response.status() >= 400) {
      throw new Error(`Page failed to load: HTTP ${response.status()}`);
    }
    return await page.content();
  } finally {
    await browser.close();
  }
}

export function parseHtml(html: string, pageUrl: string) {
  const $ = cheerio.load(html);
  const parsed = new URL(pageUrl);
  const pageDomain = normalizeDomain(parsed.hostname);

  const title = $("title").first().text().replace(/\s+/g, " ").trim();
  const desc =
    $('meta[name="description"]').attr("content")?.trim() ??
    $('meta[name="Description"]').attr("content")?.trim() ??
    "";

  const headings = extractHeadings($);
  const hierarchyOk = logicalHierarchyOk(headingLevelsInOrder($));

  return {
    meta: {
      title,
      title_length: title.length,
      description: desc,
      description_length: desc.length,
    },
    headings,
    wordCount: visibleWordCount($),
    links: countLinks($, pageUrl, pageDomain),
    images: countImages($),
    headingHierarchyOk: hierarchyOk,
  };
}

export async function auditPage(url: string): Promise<AuditResult> {
  const trimmed = url.trim();
  const parsed = new URL(trimmed);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("URL must use http or https");
  }

  const html = await crawlPage(trimmed);
  const parsedData = parseHtml(html, trimmed);
  const { score, issues } = scoreAndIssues(parsedData);

  return {
    url: trimmed,
    crawledAt: new Date().toISOString(),
    metaTitle: parsedData.meta.title,
    metaDescription: parsedData.meta.description,
    meta: parsedData.meta,
    headings: parsedData.headings,
    wordCount: parsedData.wordCount,
    links: parsedData.links,
    images: parsedData.images,
    headingHierarchyOk: parsedData.headingHierarchyOk,
    seoScore: score,
    issues,
  };
}
