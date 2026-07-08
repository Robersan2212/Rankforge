import type { Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";

const HEADING_RE = /^(#{1,3})\s+(.+)$/;

export class StreamingMarkdownBuffer {
  private buffer = "";
  private processedLength = 0;

  append(chunk: string): void {
    this.buffer += chunk;
  }

  get fullText(): string {
    return this.buffer;
  }

  flush(editor: Editor): void {
    const unprocessed = this.buffer.slice(this.processedLength);
    if (!unprocessed) return;

    const lastNewline = unprocessed.lastIndexOf("\n");
    if (lastNewline === -1) {
      return;
    }

    const toProcess = unprocessed.slice(0, lastNewline + 1);
    this.processedLength += toProcess.length;

    const lines = toProcess.split("\n");
    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const headingMatch = line.match(HEADING_RE);
      if (headingMatch) {
        const level = headingMatch[1].length as 1 | 2 | 3;
        const text = headingMatch[2].trim();
        editor
          .chain()
          .focus("end")
          .insertContent({
            type: "heading",
            attrs: { level },
            content: [{ type: "text", text }],
          })
          .insertContent({ type: "paragraph" })
          .run();
        continue;
      }

      editor
        .chain()
        .focus("end")
        .insertContent({
          type: "paragraph",
          content: [{ type: "text", text: line }],
        })
        .run();
    }
  }

  flushRemaining(editor: Editor): void {
    const remaining = this.buffer.slice(this.processedLength);
    if (!remaining.trim()) {
      this.processedLength = this.buffer.length;
      return;
    }

    const lines = remaining.split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;

      const headingMatch = line.match(HEADING_RE);
      if (headingMatch) {
        const level = headingMatch[1].length as 1 | 2 | 3;
        const text = headingMatch[2].trim();
        editor
          .chain()
          .focus("end")
          .insertContent({
            type: "heading",
            attrs: { level },
            content: [{ type: "text", text }],
          })
          .run();
      } else {
        editor
          .chain()
          .focus("end")
          .insertContent({
            type: "paragraph",
            content: [{ type: "text", text: line }],
          })
          .run();
      }
    }

    this.processedLength = this.buffer.length;
  }

  reset(): void {
    this.buffer = "";
    this.processedLength = 0;
  }
}

export function emptyDoc(): JSONContent {
  return { type: "doc", content: [{ type: "paragraph" }] };
}
