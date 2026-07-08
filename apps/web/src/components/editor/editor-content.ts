import type { JSONContent } from "@tiptap/react";

const MARKDOWN_HEADING_RE = /^(#{1,6})\s+(.+)$/;

export function serializeEditorContent(json: JSONContent): string {
  return JSON.stringify(json);
}

export interface ParsedEditorContent {
  type: "json" | "plain";
  json?: JSONContent;
  plainText?: string;
}

export function parseStoredContent(raw: string | null | undefined): ParsedEditorContent {
  if (!raw?.trim()) {
    return { type: "plain", plainText: "" };
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed) as JSONContent;
      if (json && typeof json === "object" && json.type === "doc") {
        return { type: "json", json };
      }
    } catch {
      // fall through to plain text
    }
  }

  return { type: "plain", plainText: raw };
}

export function plainTextToDoc(text: string): JSONContent {
  const lines = text.split(/\n/).map((line) => line.trim());

  const content: JSONContent[] = [];
  for (const line of lines) {
    if (!line) continue;

    const headingMatch = line.match(MARKDOWN_HEADING_RE);
    if (headingMatch) {
      const level = Math.min(6, headingMatch[1].length);
      content.push({
        type: "heading",
        attrs: { level },
        content: [{ type: "text", text: headingMatch[2].trim() }],
      });
      continue;
    }

    content.push({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    });
  }

  if (content.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }

  return { type: "doc", content };
}
