"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import type { JSONContent } from "@tiptap/react";
import { ContentEditor } from "@/components/editor/content-editor";
import { serializeEditorContent } from "@/components/editor/editor-content";
import { SeoSidebar } from "@/components/editor/seo-sidebar";
import { useDebouncedMetrics } from "@/components/editor/use-debounced-metrics";
import { useDraftAutosave } from "@/components/editor/use-draft-autosave";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isGeneratedBriefContent } from "@/lib/brief-types";
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
  const [title, setTitle] = useState(draft.title ?? "");
  const [content, setContent] = useState(draft.content ?? "");
  const [editorState, setEditorState] = useState<{
    text: string;
    json: JSONContent;
  }>({
    text: "",
    json: { type: "doc", content: [] },
  });

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

  const { saveStatus, lastSavedAt } = useDraftAutosave({
    projectId: project.id,
    draftId: draft.id,
    title,
    content,
    briefId: selectedBriefId || null,
  });

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
        <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="draft-title">Title</Label>
        <Input
          id="draft-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Draft title"
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
          />
          <ContentEditor
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
}: {
  briefs: Brief[];
  selectedBriefId: string;
  onBriefChange: (id: string) => void;
  manualKeyword: string;
  onManualKeywordChange: (value: string) => void;
  manualTargetWords: string;
  onManualTargetWordsChange: (value: string) => void;
  showManualFallback: boolean;
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
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            />
          </div>
        </div>
      )}
    </div>
  );
}
