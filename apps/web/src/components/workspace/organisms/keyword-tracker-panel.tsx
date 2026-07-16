"use client";

import { RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/workspace/molecules/empty-state";
import { DeleteConfirmDialog } from "@/components/workspace/molecules/delete-confirm-dialog";
import { SECTION_CONFIG } from "@/lib/workspace";
import type {
  KeywordRanking,
  KeywordRankingHistory,
  TrackedKeyword,
} from "@/lib/types";
import { formatShortDate } from "@/lib/format-date";

const SERIES_COLORS = [
  "#0f766e",
  "#b45309",
  "#1d4ed8",
  "#be123c",
  "#7c3aed",
  "#047857",
];

interface KeywordTrackerPanelProps {
  projectId: string;
  items: TrackedKeyword[];
}

function formatDate(value: string) {
  return formatShortDate(value);
}

function formatPosition(value: number | null | undefined) {
  if (value == null) return "Not ranked";
  return `#${value}`;
}

function detailMessage(data: unknown, fallback: string) {
  if (
    typeof data === "object" &&
    data !== null &&
    "detail" in data &&
    typeof (data as { detail: unknown }).detail === "string"
  ) {
    return (data as { detail: string }).detail;
  }
  return fallback;
}

export function KeywordTrackerPanel({
  projectId,
  items,
}: KeywordTrackerPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const config = SECTION_CONFIG.keywords;

  const [keyword, setKeyword] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [histories, setHistories] = useState<
    Record<string, KeywordRanking[]>
  >({});
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistories = useCallback(async (keywords: TrackedKeyword[]) => {
    if (keywords.length === 0) {
      setHistories({});
      return;
    }
    setHistoryLoading(true);
    try {
      const entries = await Promise.all(
        keywords.map(async (kw) => {
          const res = await fetch(
            `/api/projects/${projectId}/keywords/${kw.id}/history`
          );
          if (!res.ok) return [kw.id, [] as KeywordRanking[]] as const;
          const data = (await res.json()) as KeywordRankingHistory;
          return [kw.id, data.history] as const;
        })
      );
      setHistories(Object.fromEntries(entries));
    } finally {
      setHistoryLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadHistories(items);
  }, [items, loadHistories]);

  const chartData = useMemo(() => {
    const byDate = new Map<string, Record<string, number | null | string>>();

    for (const kw of items) {
      const points = histories[kw.id] ?? [];
      for (const point of points) {
        const dateKey = point.checked_at.slice(0, 10);
        const row = byDate.get(dateKey) ?? { date: dateKey };
        row[kw.id] = point.position;
        byDate.set(dateKey, row);
      }
    }

    return Array.from(byDate.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );
  }, [items, histories]);

  const yDomainMax = useMemo(() => {
    let max = 10;
    for (const points of Object.values(histories)) {
      for (const p of points) {
        if (typeof p.position === "number" && p.position > max) {
          max = p.position;
        }
      }
    }
    return Math.max(10, max);
  }, [histories]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: keyword.trim(),
          target_url: targetUrl.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(detailMessage(data, `Failed to add keyword (${res.status})`));
        return;
      }
      setKeyword("");
      setTargetUrl("");
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError("Could not add keyword. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh(keywordId: string) {
    setError(null);
    setRefreshingId(keywordId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/keywords/${keywordId}/refresh`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          detailMessage(data, `Refresh failed (${res.status})`)
        );
        return;
      }
      await loadHistories(items);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError("Could not refresh ranking. Try again.");
    } finally {
      setRefreshingId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTargetId) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/keywords/${deleteTargetId}`,
        { method: "DELETE" }
      );
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(
          detailMessage(data, "Could not delete this keyword.")
        );
        return;
      }
      setDeleteTargetId(null);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setDeleteError("Could not delete this keyword. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  const canSubmit = keyword.trim().length > 0;
  const hasChartPoints = chartData.length > 0;

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-border bg-card p-5 space-y-4"
      >
        <h2 className="text-sm font-medium">Add tracked keyword</h2>

        <div className="space-y-2">
          <Label htmlFor="tracked-keyword">Keyword</Label>
          <Input
            id="tracked-keyword"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="seo tips for startups"
            required
            maxLength={200}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="target-url">Target URL (optional)</Label>
          <Input
            id="target-url"
            type="url"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://example.com/blog/seo-tips"
          />
          <p className="text-xs text-muted-foreground">
            Used to match your page in Google results. Without it, checks still
            run but position stays &quot;not ranked.&quot;
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading || isPending || !canSubmit}>
          {loading ? "Adding…" : isPending ? "Updating…" : "Add keyword"}
        </Button>
      </form>

      {items.length > 0 ? (
        <>
          <div className="rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-medium">
                {config.label} ({items.length})
              </h2>
            </div>
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium truncate">{item.keyword}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatPosition(item.latest_position ?? null)}
                      {item.latest_checked_at
                        ? ` · ${formatDate(item.latest_checked_at)}`
                        : " · Not checked yet"}
                      {item.target_url ? ` · ${item.target_url}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={refreshingId === item.id || isPending}
                      onClick={() => void handleRefresh(item.id)}
                    >
                      <RefreshCw
                        className={`size-4 mr-2 ${
                          refreshingId === item.id ? "animate-spin" : ""
                        }`}
                      />
                      {refreshingId === item.id ? "Checking…" : "Check now"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Delete keyword"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTargetId(item.id);
                      }}
                      disabled={deleting}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <DeleteConfirmDialog
              open={deleteTargetId !== null}
              onOpenChange={(open) => {
                if (!deleting) {
                  if (!open) {
                    setDeleteTargetId(null);
                    setDeleteError(null);
                  }
                }
              }}
              title="Remove tracked keyword?"
              description="Stops tracking this keyword. You can add the same phrase again later."
              error={deleteError}
              confirmLabel="Remove keyword"
              onConfirm={() => void handleConfirmDelete()}
              loading={deleting}
            />
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-medium">Ranking history</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Position over time (1 is best). Gaps mean not found in top
                results.
              </p>
            </div>

            {historyLoading && !hasChartPoints ? (
              <p className="text-sm text-muted-foreground">Loading chart…</p>
            ) : hasChartPoints ? (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => formatDate(String(v))}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      reversed
                      domain={[1, yDomainMax]}
                      allowDecimals={false}
                      tick={{ fontSize: 12 }}
                      label={{
                        value: "Position",
                        angle: -90,
                        position: "insideLeft",
                        style: { fontSize: 12 },
                      }}
                    />
                    <Tooltip
                      labelFormatter={(label) => formatDate(String(label))}
                      formatter={(value, name) => {
                        const label =
                          items.find((k) => k.id === name)?.keyword ??
                          String(name);
                        return [
                          value == null ? "Not ranked" : `#${value}`,
                          label,
                        ];
                      }}
                    />
                    <Legend
                      formatter={(value) =>
                        items.find((k) => k.id === value)?.keyword ?? value
                      }
                    />
                    {items.map((kw, index) => (
                      <Line
                        key={kw.id}
                        type="monotone"
                        dataKey={kw.id}
                        name={kw.id}
                        stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        connectNulls={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No ranking checks yet. Use &quot;Check now&quot; on a keyword
                to record the first date-stamped point.
              </p>
            )}
          </div>
        </>
      ) : (
        <EmptyState
          icon={config.icon}
          title="No tracked keywords yet"
          description={config.description}
        />
      )}
    </div>
  );
}
