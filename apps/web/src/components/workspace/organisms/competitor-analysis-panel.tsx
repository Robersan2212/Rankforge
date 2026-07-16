"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/workspace/molecules/empty-state";
import { CompetitorDeleteButton } from "@/components/workspace/molecules/competitor-delete-button";
import { ListRow } from "@/components/workspace/molecules/list-row";
import { SECTION_CONFIG } from "@/lib/workspace";
import type { CompetitorAnalysis } from "@/lib/types";
import { formatShortDate } from "@/lib/format-date";

interface CompetitorAnalysisPanelProps {
  projectId: string;
  items: CompetitorAnalysis[];
}

function formatDate(value: string) {
  return formatShortDate(value);
}

function statusLabel(status: CompetitorAnalysis["status"]) {
  switch (status) {
    case "pending":
    case "running":
      return "Analyzing…";
    case "completed":
      return "Complete";
    case "partial":
      return "Partial";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export function CompetitorAnalysisPanel({
  projectId,
  items,
}: CompetitorAnalysisPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const config = SECTION_CONFIG.competitors;

  const [keyword, setKeyword] = useState("");
  const [userPageUrl, setUserPageUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function pollUntilDone(analysisId: string) {
    const maxAttempts = 120;
    let attempts = 0;

    return new Promise<CompetitorAnalysis>((resolve, reject) => {
      pollRef.current = setInterval(async () => {
        attempts += 1;
        if (attempts > maxAttempts) {
          if (pollRef.current) clearInterval(pollRef.current);
          reject(new Error("Analysis timed out while waiting for results"));
          return;
        }

        try {
          const res = await fetch(
            `/api/projects/${projectId}/competitor-analyses/${analysisId}`
          );
          if (!res.ok) return;
          const data = (await res.json()) as CompetitorAnalysis;
          if (
            data.status === "completed" ||
            data.status === "partial" ||
            data.status === "failed"
          ) {
            if (pollRef.current) clearInterval(pollRef.current);
            resolve(data);
          }
        } catch {
          // keep polling
        }
      }, 3000);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(
        `/api/projects/${projectId}/competitor-analyses`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyword: keyword.trim(),
            user_page_url: userPageUrl.trim(),
          }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data.detail;
        setError(
          typeof detail === "string"
            ? detail
            : `Failed to start analysis (${res.status})`
        );
        return;
      }

      const analysis = data as CompetitorAnalysis;
      await pollUntilDone(analysis.id);

      setKeyword("");
      setUserPageUrl("");
      startTransition(() => {
        router.push(`/project/${projectId}/competitors/${analysis.id}`);
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not complete analysis."
      );
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = keyword.trim().length > 0 && userPageUrl.trim().length > 0;

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-border bg-card p-5 space-y-4"
      >
        <h2 className="text-sm font-medium">Run competitor analysis</h2>

        <div className="space-y-2">
          <Label htmlFor="competitor-keyword">Target keyword</Label>
          <Input
            id="competitor-keyword"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="seo tips for startups"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="user-page-url">Your page URL</Label>
          <Input
            id="user-page-url"
            type="url"
            value={userPageUrl}
            onChange={(e) => setUserPageUrl(e.target.value)}
            placeholder="https://example.com/blog/seo-tips"
            required
          />
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading || isPending || !canSubmit}>
          {loading
            ? "Analyzing competitors… this may take a few minutes"
            : isPending
              ? "Loading…"
              : "Run analysis"}
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
            {items.map((item) => (
              <ListRow
                key={item.id}
                title={item.keyword}
                subtitle={`${statusLabel(item.status)} · ${formatDate(item.created_at)}`}
                initials="CA"
                href={`/project/${projectId}/competitors/${item.id}`}
                trailing={
                  <CompetitorDeleteButton
                    projectId={projectId}
                    analysisId={item.id}
                  />
                }
              />
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={config.icon}
          title="No competitor analyses yet"
          description={config.description}
        />
      )}
    </div>
  );
}
