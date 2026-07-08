export type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export interface HeadingCounts {
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  h5: number;
  h6: number;
  total: number;
}

export interface HeadingValidationResult {
  counts: HeadingCounts;
  warnings: string[];
  isValid: boolean;
}

export interface HeadingEntry {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

const HEADING_LEVELS: HeadingLevel[] = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
];

function emptyCounts(): HeadingCounts {
  return { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0, total: 0 };
}

function isHeadingLevel(type: string): type is HeadingLevel {
  return HEADING_LEVELS.includes(type as HeadingLevel);
}

function levelToHeadingKey(level: number): HeadingLevel | null {
  if (level >= 1 && level <= 6) {
    return `h${level}` as HeadingLevel;
  }
  return null;
}

function extractTextFromNode(node: unknown): string {
  if (!node || typeof node !== "object") return "";

  const record = node as Record<string, unknown>;
  if (record.type === "text" && typeof record.text === "string") {
    return record.text;
  }

  const content = record.content;
  if (Array.isArray(content)) {
    return content.map(extractTextFromNode).join("");
  }

  return "";
}

function walkNodes(node: unknown, counts: HeadingCounts): void {
  if (!node || typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  const type = record.type;

  if (type === "heading") {
    const attrs = record.attrs as Record<string, unknown> | undefined;
    const level = typeof attrs?.level === "number" ? attrs.level : null;
    const key = level !== null ? levelToHeadingKey(level) : null;
    if (key) {
      counts[key] += 1;
      counts.total += 1;
    }
  } else if (typeof type === "string" && isHeadingLevel(type)) {
    counts[type] += 1;
    counts.total += 1;
  }

  const content = record.content;
  if (Array.isArray(content)) {
    for (const child of content) {
      walkNodes(child, counts);
    }
  }
}

function buildWarnings(counts: HeadingCounts): string[] {
  const warnings: string[] = [];

  if (counts.total === 0) {
    warnings.push("No headings found — add structure with H1–H6.");
    return warnings;
  }

  if (counts.h1 === 0) {
    warnings.push("Missing H1 — add a single top-level heading.");
  } else if (counts.h1 > 1) {
    warnings.push(`Multiple H1 headings (${counts.h1}) — use only one H1.`);
  }

  const levelsPresent = HEADING_LEVELS.filter((level) => counts[level] > 0);
  for (let i = 1; i < levelsPresent.length; i++) {
    const prevIdx = HEADING_LEVELS.indexOf(levelsPresent[i - 1]);
    const currIdx = HEADING_LEVELS.indexOf(levelsPresent[i]);
    if (currIdx - prevIdx > 1) {
      warnings.push(
        `Skipped heading level: ${levelsPresent[i - 1]} → ${levelsPresent[i]}.`
      );
    }
  }

  return warnings;
}

function walkHeadings(node: unknown, entries: HeadingEntry[]): void {
  if (!node || typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  const type = record.type;

  if (type === "heading") {
    const attrs = record.attrs as Record<string, unknown> | undefined;
    const level = typeof attrs?.level === "number" ? attrs.level : null;
    if (level !== null && level >= 1 && level <= 6) {
      entries.push({
        level: level as HeadingEntry["level"],
        text: extractTextFromNode(node),
      });
    }
  } else if (typeof type === "string" && isHeadingLevel(type)) {
    const level = Number.parseInt(type.slice(1), 10) as HeadingEntry["level"];
    entries.push({ level, text: extractTextFromNode(node) });
  }

  const content = record.content;
  if (Array.isArray(content)) {
    for (const child of content) {
      walkHeadings(child, entries);
    }
  }
}

export function extractHeadings(docJson: unknown): HeadingEntry[] {
  const entries: HeadingEntry[] = [];
  if (!docJson || typeof docJson !== "object") {
    return entries;
  }
  walkHeadings(docJson, entries);
  return entries;
}

export function validateHeadings(docJson: unknown): HeadingValidationResult {
  const counts = emptyCounts();

  if (!docJson || typeof docJson !== "object") {
    return {
      counts,
      warnings: ["Invalid document — no heading data available."],
      isValid: false,
    };
  }

  walkNodes(docJson, counts);
  const warnings = buildWarnings(counts);

  return {
    counts,
    warnings,
    isValid: warnings.length === 0,
  };
}
