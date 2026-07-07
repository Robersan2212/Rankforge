import type { JSONContent } from "@tiptap/react";

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
  const paragraphs = text.split(/\n\n+/).filter((block) => block.length > 0);

  if (paragraphs.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }

  return {
    type: "doc",
    content: paragraphs.map((block) => ({
      type: "paragraph",
      content: block ? [{ type: "text", text: block }] : undefined,
    })),
  };
}
