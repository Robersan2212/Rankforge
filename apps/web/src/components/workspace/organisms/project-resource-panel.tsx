"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/workspace/molecules/empty-state";
import { AuditDeleteButton } from "@/components/workspace/molecules/audit-delete-button";
import { ListRow } from "@/components/workspace/molecules/list-row";
import {
  SECTION_API_PATH,
  SECTION_CONFIG,
  type ProjectSection,
} from "@/lib/workspace";
import type { Audit, Brief, Draft, TrackedKeyword } from "@/lib/types";

type SectionItem = Audit | Brief | Draft | TrackedKeyword;

interface ProjectResourcePanelProps {
  projectId: string;
  section: ProjectSection;
  items: SectionItem[];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getItemTitle(section: ProjectSection, item: SectionItem): string {
  switch (section) {
    case "audits":
      return (item as Audit).url;
    case "briefs":
      return (item as Brief).keyword;
    case "editor":
      return (item as Draft).title ?? "Untitled draft";
    case "keywords":
      return (item as TrackedKeyword).keyword;
  }
}

function getItemSubtitle(section: ProjectSection, item: SectionItem): string {
  switch (section) {
    case "audits": {
      const audit = item as Audit;
      const score =
        typeof audit.seo_score === "number" ? `Score ${audit.seo_score}` : null;
      const date = formatDate(audit.created_at);
      return score ? `${score} · ${date}` : `Added ${date}`;
    }
    case "briefs": {
      const brief = item as Brief;
      const title = brief.content?.title;
      return title ? `${title} · ${formatDate(brief.created_at)}` : formatDate(brief.created_at);
    }
    case "editor": {
      const draft = item as Draft;
      const preview = draft.content?.trim();
      return preview
        ? `${preview.slice(0, 80)}${preview.length > 80 ? "…" : ""}`
        : `Updated ${formatDate(draft.updated_at)}`;
    }
    case "keywords":
      return `Tracked ${formatDate((item as TrackedKeyword).created_at)}`;
  }
}

function buildPayload(
  section: ProjectSection,
  form: { url: string; keyword: string; title: string; content: string }
): Record<string, string> {
  switch (section) {
    case "audits":
      return { url: form.url.trim() };
    case "briefs":
      return {
        keyword: form.keyword.trim(),
        ...(form.title.trim() ? { title: form.title.trim() } : {}),
      };
    case "editor":
      return {
        title: form.title.trim(),
        content: form.content.trim(),
      };
    case "keywords":
      return { keyword: form.keyword.trim() };
  }
}

export function ProjectResourcePanel({
  projectId,
  section,
  items,
}: ProjectResourcePanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const config = SECTION_CONFIG[section];
  const apiPath = SECTION_API_PATH[section];

  const [url, setUrl] = useState("");
  const [keyword, setKeyword] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = buildPayload(section, { url, keyword, title, content });

    try {
      const res = await fetch(`/api/projects/${projectId}/${apiPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data.detail;
        const message =
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
              ? detail
                  .map((item: { msg?: string }) => item.msg)
                  .filter(Boolean)
                  .join(". ")
              : res.status === 500 && typeof detail === "string"
                ? detail
                : `Failed to add ${config.singular} (${res.status})`;
        setError(message);
        return;
      }

      if (section === "audits") {
        const audit = data as {
          id?: string;
          seo_score?: number;
          report?: unknown;
          results?: unknown;
        };
        const payload = audit.report ?? audit.results;
        const hasReport =
          payload &&
          typeof payload === "object" &&
          "score_breakdown" in (payload as object);

        if (!hasReport || !audit.seo_score) {
          setError(
            "Audit saved without report data. Ensure the API and page-auditor (port 3001) are running, then try again."
          );
          return;
        }

        setUrl("");
        startTransition(() => {
          router.push(`/project/${projectId}/audits/${audit.id}`);
        });
        return;
      }

      setUrl("");
      setKeyword("");
      setTitle("");
      setContent("");
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError(`Could not add ${config.singular}. Try again.`);
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    section === "audits"
      ? url.trim().length > 0
      : section === "keywords"
        ? keyword.trim().length > 0
        : section === "briefs"
          ? keyword.trim().length > 0
          : title.trim().length > 0;

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-border bg-card p-5 space-y-4"
      >
        <h2 className="text-sm font-medium">Add {config.singular}</h2>

        {section === "audits" && (
          <div className="space-y-2">
            <Label htmlFor="audit-url">Page URL</Label>
            <Input
              id="audit-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
            />
          </div>
        )}

        {section === "briefs" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="brief-keyword">Target keyword</Label>
              <Input
                id="brief-keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="best running shoes"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brief-title">Title (optional)</Label>
              <Input
                id="brief-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief title"
              />
            </div>
          </>
        )}

        {section === "editor" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="draft-title">Title</Label>
              <Input
                id="draft-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Draft title"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="draft-content">Content</Label>
              <textarea
                id="draft-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start writing…"
                rows={5}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </>
        )}

        {section === "keywords" && (
          <div className="space-y-2">
            <Label htmlFor="tracked-keyword">Keyword</Label>
            <Input
              id="tracked-keyword"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="rank tracking keyword"
              required
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading || isPending || !canSubmit}>
          {loading
            ? section === "audits"
              ? "Auditing… may take up to 15s"
              : "Saving…"
            : isPending
              ? "Loading…"
              : section === "audits"
                ? "Run audit"
                : `Save ${config.singular}`}
        </Button>
      </form>

      {items.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium">
              {config.label} ({items.length})
            </h2>
          </div>
          <div className="space-y-1 p-3">
            {items.map((item) => {
              const audit = section === "audits" ? (item as Audit) : null;

              return (
                <ListRow
                  key={item.id}
                  title={getItemTitle(section, item)}
                  subtitle={getItemSubtitle(section, item)}
                  badge={
                    audit && audit.seo_score > 0
                      ? String(audit.seo_score)
                      : undefined
                  }
                  initials={config.label.slice(0, 2).toUpperCase()}
                  href={
                    section === "audits"
                      ? `/project/${projectId}/audits/${item.id}`
                      : undefined
                  }
                  trailing={
                    audit ? (
                      <AuditDeleteButton
                        projectId={projectId}
                        auditId={audit.id}
                      />
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={config.icon}
          title={`No ${config.label.toLowerCase()} yet`}
          description={config.description}
        />
      )}
    </div>
  );
}
