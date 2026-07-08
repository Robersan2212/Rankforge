"use client";

import {
  useEditor,
  EditorContent,
  type JSONContent,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  parseStoredContent,
  plainTextToDoc,
} from "@/components/editor/editor-content";
import {
  StreamingMarkdownBuffer,
  emptyDoc,
} from "@/components/editor/streaming-markdown";

export interface EditorUpdatePayload {
  json: JSONContent;
  text: string;
}

export interface ContentEditorHandle {
  clear: () => void;
  insertStreamingChunk: (text: string) => void;
  flushStreamingBuffer: () => void;
}

interface ContentEditorProps {
  initialContent: string | null;
  onUpdate: (payload: EditorUpdatePayload) => void;
  className?: string;
}

function ToolbarButton({
  onPress,
  active,
  children,
  title,
}: {
  onPress: () => void;
  active?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon-sm"
      onMouseDown={(event) => {
        event.preventDefault();
        onPress();
      }}
      title={title}
      aria-label={title}
      aria-pressed={active}
    >
      {children}
    </Button>
  );
}

export const ContentEditor = forwardRef<ContentEditorHandle, ContentEditorProps>(
  function ContentEditor({ initialContent, onUpdate, className }, ref) {
    const streamBufferRef = useRef(new StreamingMarkdownBuffer());
    const onUpdateRef = useRef(onUpdate);
    onUpdateRef.current = onUpdate;

    const extensions = useMemo(() => [StarterKit], []);

    const initialJson = useMemo(() => {
      const parsed = parseStoredContent(initialContent);
      return parsed.type === "json" && parsed.json
        ? parsed.json
        : plainTextToDoc(parsed.plainText ?? "");
    }, [initialContent]);

    const editor = useEditor(
      {
        extensions,
        content: initialJson,
        immediatelyRender: false,
        shouldRerenderOnTransaction: true,
        editorProps: {
          attributes: {
            class:
              "min-h-[320px] px-4 py-3 focus:outline-none",
          },
        },
        onUpdate: ({ editor: ed }) => {
          onUpdateRef.current({
            json: ed.getJSON(),
            text: ed.getText(),
          });
        },
      },
      [initialContent]
    );

    useImperativeHandle(
      ref,
      () => ({
        clear: () => {
          if (!editor) return;
          streamBufferRef.current.reset();
          editor.commands.setContent(emptyDoc());
          onUpdateRef.current({ json: emptyDoc(), text: "" });
        },
        insertStreamingChunk: (text: string) => {
          if (!editor) return;
          streamBufferRef.current.append(text);
          streamBufferRef.current.flush(editor);
          onUpdateRef.current({
            json: editor.getJSON(),
            text: editor.getText(),
          });
        },
        flushStreamingBuffer: () => {
          if (!editor) return;
          streamBufferRef.current.flushRemaining(editor);
          onUpdateRef.current({
            json: editor.getJSON(),
            text: editor.getText(),
          });
        },
      }),
      [editor]
    );

    useEffect(() => {
      if (!editor) return;
      onUpdateRef.current({
        json: editor.getJSON(),
        text: editor.getText(),
      });
    }, [editor]);

    if (!editor) {
      return (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Loading editor…
        </div>
      );
    }

    return (
      <div className={cn("rounded-2xl border border-border bg-card", className)}>
        <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-2">
          <ToolbarButton
            onPress={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Bold"
          >
            <Bold className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            onPress={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Italic"
          >
            <Italic className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            onPress={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            active={editor.isActive("heading", { level: 1 })}
            title="Heading 1"
          >
            <Heading1 className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            onPress={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            active={editor.isActive("heading", { level: 2 })}
            title="Heading 2"
          >
            <Heading2 className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            onPress={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            active={editor.isActive("heading", { level: 3 })}
            title="Heading 3"
          >
            <Heading3 className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            onPress={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="Bullet list"
          >
            <List className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            onPress={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="Ordered list"
          >
            <ListOrdered className="size-4" />
          </ToolbarButton>
        </div>
        <EditorContent editor={editor} className="editor-surface" />
      </div>
    );
  }
);
