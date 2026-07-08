"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { JSONContent } from "@tiptap/react";
import {
  ContentEditor,
  type ContentEditorHandle,
} from "@/components/editor/content-editor";
import { serializeEditorContent } from "@/components/editor/editor-content";
import { SeoSidebar } from "@/components/editor/seo-sidebar";
import { useDebouncedMetrics } from "@/components/editor/use-debounced-metrics";
import { useDraftAutosave } from "@/components/editor/use-draft-autosave";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isGeneratedBriefContent } from "@/lib/brief-types";
import { useDraftStream } from "@/lib/use-draft-stream";
import type { Brief, Draft, Project } from "@/lib/types";

interface DraftEditorViewProps {
  project: Project;
  draft: Draft;
  briefs: Brief[];
  initialBriefId?: string | null;
}

export function DraftEditorView({
  project,
  draft,
  briefs,
  initialBriefId,
}: DraftEditorViewProps) {
  const editorRef = useRef<ContentEditorHandle>(null);
  const [title, setTitle] = useState(draft.title ?? "");
  const [content, setContent] = useState(draft.content ?? "");
  const [editorState, setEditorState] = useState<{
    text: string;
    json: JSONContent;
  }>({
    text: "",
    json: { type: "doc", content: [] },
  });
  const [showAiDisclaimer, setShowAiDisclaimer] = useState(false);

  const [selectedBriefId, setSelectedBriefId] = useState<string>(
    draft.brief_id ?? initialBriefId ?? ""
  );
  const [manualKeyword, setManualKeyword] = useState("");
  const [manualTargetWords, setManualTargetWords] = useState("");

  const selectedBrief = useMemo(
    () => briefs.find((b) => b.id === selectedBriefId) ?? null,
    [briefs, selectedBriefId]
  );

  const briefContent = useMemo(
    () =>
      selectedBrief && isGeneratedBriefContent(selectedBrief.content)
        ? selectedBrief.content
        : null,
    [selectedBrief]
  );

  const metricsConfig = useMemo(() => {
    if (briefContent) {
      return {
        primaryKeyword: briefContent.primary_keyword,
        semanticKeywords: briefContent.semantic_keywords,
        targetWordCount: briefContent.target_word_count,
      };
    }

    const parsedTarget = parseInt(manualTargetWords, 10);
    return {
      primaryKeyword: manualKeyword.trim(),
      semanticKeywords: [] as string[],
      targetWordCount:
        Number.isFinite(parsedTarget) && parsedTarget > 0
          ? parsedTarget
          : undefined,
    };
  }, [briefContent, manualKeyword, manualTargetWords]);

  const metrics = useDebouncedMetrics(editorState, metricsConfig);

  const handleEditorUpdate = useCallback(
    (payload: { json: JSONContent; text: string }) => {
      setEditorState(payload);
      setContent(serializeEditorContent(payload.json));
    },
    []
  );

  const handleStreamToken = useCallback((text: string) => {
    editorRef.current?.insertStreamingChunk(text);
  }, []);

  const handleStreamDone = useCallback(() => {
    editorRef.current?.flushStreamingBuffer();
    setShowAiDisclaimer(true);
    if (!title.trim() && briefContent?.primary_keyword) {
      setTitle(briefContent.primary_keyword);
    }
  }, [title, briefContent?.primary_keyword]);

  const {
    status: streamStatus,
    chunkCount,
    timeToFirstTokenMs,
    error: streamError,
    startGeneration,
    abort,
  } = useDraftStream({
    projectId: project.id,
    onToken: handleStreamToken,
    onDone: handleStreamDone,
  });

  const isGenerating =
    streamStatus === "connecting" || streamStatus === "streaming";

  const { saveStatus, lastSavedAt } = useDraftAutosave({
    projectId: project.id,
    draftId: draft.id,
    title,
    content,
    briefId: selectedBriefId || null,
    enabled: !isGenerating,
  });

  const handleGenerate = useCallback(async () => {
    if (!selectedBriefId || !briefContent) return;

    editorRef.current?.clear();
    setShowAiDisclaimer(true);

    await startGeneration({
      brief_id: selectedBriefId,
      draft_id: draft.id,
    });
  }, [selectedBriefId, briefContent, draft.id, startGeneration]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0">
          <Link
            href={`/project/${project.id}/editor`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to drafts
          </Link>
          <h1 className="text-xl font-semibold">Content editor</h1>
          <p className="text-sm text-muted-foreground">
            {project.name} · Live SEO scoring
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <GenerationStatus
            streamStatus={streamStatus}
            chunkCount={chunkCount}
            timeToFirstTokenMs={timeToFirstTokenMs}
          />
          <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="draft-title">Title</Label>
        <Input
          id="draft-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Draft title"
          disabled={isGenerating}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <BriefScoringInputs
            briefs={briefs}
            selectedBriefId={selectedBriefId}
            onBriefChange={setSelectedBriefId}
            manualKeyword={manualKeyword}
            onManualKeywordChange={setManualKeyword}
            manualTargetWords={manualTargetWords}
            onManualTargetWordsChange={setManualTargetWords}
            showManualFallback={!briefContent}
            disabled={isGenerating}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={!briefContent || isGenerating}
            >
              {isGenerating ? "Generating…" : "Generate Full Draft"}
            </Button>
            {isGenerating && (
              <Button type="button" variant="outline" onClick={abort}>
                Cancel
              </Button>
            )}
          </div>

          {streamError && (
            <div
              className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              Generation failed: {streamError.message}
            </div>
          )}

          {showAiDisclaimer && (
            <p className="text-xs text-muted-foreground">
              AI-generated first draft — review and fact-check before publishing.
            </p>
          )}

          <ContentEditor
            ref={editorRef}
            initialContent={draft.content}
            onUpdate={handleEditorUpdate}
          />
        </div>
        <SeoSidebar
          metrics={metrics}
          primaryKeyword={metricsConfig.primaryKeyword}
        />
      </div>
    </div>
  );
}

function GenerationStatus({
  streamStatus,
  chunkCount,
  timeToFirstTokenMs,
}: {
  streamStatus: string;
  chunkCount: number;
  timeToFirstTokenMs: number | null;
}) {
  if (streamStatus === "connecting") {
    return (
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Starting generation…
      </p>
    );
  }

  if (streamStatus === "streaming") {
    return (
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Streaming draft
        {timeToFirstTokenMs !== null
          ? ` · first token ${timeToFirstTokenMs}ms`
          : ""}
        {chunkCount > 0 ? ` · ${chunkCount} chunks` : ""}
      </p>
    );
  }

  if (streamStatus === "done" && timeToFirstTokenMs !== null) {
    return (
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Generation complete · first token {timeToFirstTokenMs}ms · {chunkCount}{" "}
        chunks
      </p>
    );
  }

  return null;
}

function SaveStatusIndicator({
  status,
  lastSavedAt,
}: {
  status: "idle" | "saving" | "saved" | "error";
  lastSavedAt: Date | null;
}) {
  const label =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? lastSavedAt
          ? `Saved ${lastSavedAt.toLocaleTimeString()}`
          : "Saved"
        : status === "error"
          ? "Save failed"
          : "";

  if (!label) return null;

  return (
    <p
      className={`text-sm ${
        status === "error"
          ? "text-destructive"
          : "text-muted-foreground"
      }`}
      aria-live="polite"
    >
      {label}
    </p>
  );
}

function BriefScoringInputs({
  briefs,
  selectedBriefId,
  onBriefChange,
  manualKeyword,
  onManualKeywordChange,
  manualTargetWords,
  onManualTargetWordsChange,
  showManualFallback,
  disabled,
}: {
  briefs: Brief[];
  selectedBriefId: string;
  onBriefChange: (id: string) => void;
  manualKeyword: string;
  onManualKeywordChange: (value: string) => void;
  manualTargetWords: string;
  onManualTargetWordsChange: (value: string) => void;
  showManualFallback: boolean;
  disabled?: boolean;
}) {
  const generatedBriefs = briefs.filter((b) =>
    isGeneratedBriefContent(b.content)
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="brief-select">Content brief (optional)</Label>
        <select
          id="brief-select"
          value={selectedBriefId}
          onChange={(e) => onBriefChange(e.target.value)}
          disabled={disabled}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <option value="">No brief — manual scoring inputs</option>
          {generatedBriefs.map((brief) => (
            <option key={brief.id} value={brief.id}>
              {brief.keyword}
              {isGeneratedBriefContent(brief.content)
                ? ` (${brief.content.target_word_count} words)`
                : ""}
            </option>
          ))}
        </select>
      </div>

      {showManualFallback && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="manual-keyword">Primary keyword</Label>
            <Input
              id="manual-keyword"
              value={manualKeyword}
              onChange={(e) => onManualKeywordChange(e.target.value)}
              placeholder="target keyword"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-target">Target word count</Label>
            <Input
              id="manual-target"
              type="number"
              min={1}
              value={manualTargetWords}
              onChange={(e) => onManualTargetWordsChange(e.target.value)}
              placeholder="e.g. 1500"
              disabled={disabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}
