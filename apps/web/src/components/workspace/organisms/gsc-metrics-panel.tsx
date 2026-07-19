"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GscConnectionStatus, GscMetrics } from "@/lib/types";
import { formatShortDate } from "@/lib/format-date";

interface GscMetricsPanelProps {
  projectId: string;
  auditedUrl: string;
  metrics: GscMetrics | null | undefined;
  connection?: GscConnectionStatus | null;
}

function formatPct(value: number | undefined) {
  if (value == null) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

function formatPosition(value: number | undefined) {
  if (value == null) return "—";
  return value.toFixed(1);
}

function formatDate(value: string | undefined) {
  return formatShortDate(value);
}

export function GscMetricsPanel({
  projectId,
  auditedUrl,
  metrics,
  connection,
}: GscMetricsPanelProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [liveMetrics, setLiveMetrics] = useState<GscMetrics | null | undefined>(
    metrics
  );
  const [error, setError] = useState<string | null>(null);

  const connected = connection?.connected === true;
  const display = liveMetrics ?? metrics;

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/gsc/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, url: auditedUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.detail === "string"
            ? data.detail
            : "Could not refresh Search Console metrics."
        );
        return;
      }
      setLiveMetrics(data as GscMetrics);
    } catch {
      setError("Could not refresh Search Console metrics.");
    } finally {
      setRefreshing(false);
    }
  }

  if (!connected) {
    return (
      <section className="rounded-xl border border-dashed border-border p-4 space-y-2">
        <h3 className="text-sm font-medium">Search Console performance</h3>
        <p className="text-sm text-muted-foreground">
          Connect Google Search Console to see real impressions, clicks, CTR, and
          average position for this URL.
        </p>
        <a
          href={`/api/auth/gsc/start?project_id=${encodeURIComponent(projectId)}`}
          className={cn(
            buttonVariants({ size: "sm", variant: "outline" }),
            "rounded-full px-3.5"
          )}
        >
          Connect Google Search Console
        </a>
      </section>
    );
  }

  if (display?.status && display.status !== "ok") {
    return (
      <section className="rounded-xl border border-border p-4 space-y-2">
        <h3 className="text-sm font-medium">Search Console performance</h3>
        <p className="text-sm text-muted-foreground">
          {display.message ?? "Search Console data is unavailable for this URL."}
        </p>
        {display.status === "reconnect_required" && (
          <a
            href={`/api/auth/gsc/start?project_id=${encodeURIComponent(projectId)}`}
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "rounded-full px-3.5"
            )}
          >
            Reconnect Google Search Console
          </a>
        )}
      </section>
    );
  }

  if (!display || display.status !== "ok") {
    return null;
  }

  return (
    <section className="rounded-xl border border-border p-4 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-medium">Search Console performance</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDate(display.date_range_start)} –{" "}
            {formatDate(display.date_range_end)}
            {display.cached ? " · cached" : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={() => void handleRefresh()}
        >
          <RefreshCw
            className={`size-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
          />
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Impressions" value={String(display.impressions ?? 0)} />
        <MetricCard label="Clicks" value={String(display.clicks ?? 0)} />
        <MetricCard label="CTR" value={formatPct(display.ctr)} />
        <MetricCard label="Avg. position" value={formatPosition(display.avg_position)} />
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums mt-1">{value}</p>
    </div>
  );
}
