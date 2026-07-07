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
});
