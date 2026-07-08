import { describe, expect, it } from "vitest";
import {
  parseStoredContent,
  plainTextToDoc,
  serializeEditorContent,
} from "@/components/editor/editor-content";

describe("editor-content helpers", () => {
  it("serializes and parses TipTap JSON", () => {
    const doc = { type: "doc", content: [{ type: "paragraph" }] };
    const raw = serializeEditorContent(doc);
    const parsed = parseStoredContent(raw);
    expect(parsed.type).toBe("json");
    expect(parsed.json).toEqual(doc);
  });

  it("treats non-JSON as plain text", () => {
    const parsed = parseStoredContent("Hello world");
    expect(parsed.type).toBe("plain");
    expect(parsed.plainText).toBe("Hello world");
  });

  it("converts plain text to a doc", () => {
    const doc = plainTextToDoc("First paragraph\n\nSecond paragraph");
    expect(doc.type).toBe("doc");
    expect(doc.content).toHaveLength(2);
  });

  it("converts markdown headings in plain text to heading nodes", () => {
    const doc = plainTextToDoc("## Industries We Serve\nBody copy here.");
    expect(doc.content).toEqual([
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Industries We Serve" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Body copy here." }],
      },
    ]);
  });
});
