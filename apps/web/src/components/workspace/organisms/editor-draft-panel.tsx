"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DraftDeleteButton } from "@/components/workspace/molecules/draft-delete-button";
import { EmptyState } from "@/components/workspace/molecules/empty-state";
import { ListRow } from "@/components/workspace/molecules/list-row";
import { SECTION_CONFIG } from "@/lib/workspace";
import type { Draft } from "@/lib/types";
import { formatShortDate } from "@/lib/format-date";

interface EditorDraftPanelProps {
  projectId: string;
  drafts: Draft[];
}

function formatDate(value: string) {
  return formatShortDate(value);
}

function getDraftSubtitle(draft: Draft): string {
  const preview = draft.content?.trim();
  if (!preview) {
    return `Updated ${formatDate(draft.updated_at)}`;
  }

  if (preview.startsWith("{")) {
    return `Updated ${formatDate(draft.updated_at)}`;
  }

  return `${preview.slice(0, 80)}${preview.length > 80 ? "…" : ""}`;
}

export function EditorDraftPanel({ projectId, drafts }: EditorDraftPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const config = SECTION_CONFIG.editor;

  async function handleNewDraft() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Untitled draft",
          content: "",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Failed to create draft"
        );
      }

      const draft: Draft = await response.json();
      router.push(`/project/${projectId}/editor/${draft.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create draft");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-medium">{config.label}</h2>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </div>
        <Button type="button" onClick={handleNewDraft} disabled={loading}>
          {loading ? "Creating…" : "New draft"}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {drafts.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium">
              {config.label} ({drafts.length})
            </h2>
          </div>
          <div className="space-y-1 p-3">
            {drafts.map((draft) => (
              <ListRow
                key={draft.id}
                title={draft.title ?? "Untitled draft"}
                subtitle={getDraftSubtitle(draft)}
                initials={config.label.slice(0, 2).toUpperCase()}
                href={`/project/${projectId}/editor/${draft.id}`}
                trailing={
                  <DraftDeleteButton
                    projectId={projectId}
                    draftId={draft.id}
                  />
                }
              />
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={config.icon}
          title={`No ${config.label.toLowerCase()} yet`}
          description="Create a draft to open the rich text editor with live SEO scoring."
        />
      )}
    </div>
  );
}
