"use client";

import Link from "next/link";
import { LineChart as LineChartIcon } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/workspace/molecules/empty-state";
import { formatShortDate } from "@/lib/format-date";
import type { SeoPerformance } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SeoChartPanelProps {
  data: SeoPerformance;
  firstProjectId?: string | null;
  title?: string;
  className?: string;
}

/** Human-friendly page label — hostname + short path, never raw API-looking URLs. */
function formatPageLabel(url: string | null | undefined): string {
  if (!url?.trim()) return "Audited page";
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const path =
      parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
    if (!path) return host;
    const shortPath = path.length > 28 ? `${path.slice(0, 25)}…` : path;
    return `${host}${shortPath}`;
  } catch {
    return "Audited page";
  }
}

export function SeoChartPanel({
  data,
  firstProjectId,
  title = "SEO performance",
  className,
}: SeoChartPanelProps) {
  const points = data.points ?? [];
  const summary = data.summary;
  const chartData = points.map((point) => ({
    date: point.audited_at ?? "",
    score: point.seo_score,
    pageLabel: formatPageLabel(point.url),
    project: point.project_name,
  }));

  return (
    <div className={cn("rounded-2xl ring-1 ring-border bg-card", className)}>
      <div className="border-b border-border px-5 py-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-medium">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            On-page SEO audit scores over time
          </p>
        </div>
        {summary.audit_count > 0 && (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>
              Latest{" "}
              <span className="font-medium text-foreground">
                {summary.latest_score ?? "—"}
              </span>
            </span>
            <span>
              Avg{" "}
              <span className="font-medium text-foreground">
                {summary.average_score ?? "—"}
              </span>
            </span>
            <span>
              {summary.audit_count} audit
              {summary.audit_count === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </div>

      <div className="p-5">
        {chartData.length === 0 ? (
          <EmptyState
            icon={LineChartIcon}
            title="No performance data"
            description="Run a page audit to start tracking SEO scores on your dashboard."
            action={
              firstProjectId ? (
                <Link
                  href={`/project/${firstProjectId}/audits`}
                  className="text-sm font-medium underline-offset-4 hover:underline"
                >
                  Run a page audit
                </Link>
              ) : undefined
            }
            className="border-none bg-transparent py-10"
          />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => formatShortDate(String(value))}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  domain={[0, 100]}
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                  label={{
                    value: "SEO score",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 12 },
                  }}
                />
                <Tooltip
                  labelFormatter={(label) => formatShortDate(String(label))}
                  formatter={(value, _name, item) => {
                    const payload = item?.payload as
                      | { pageLabel?: string; project?: string }
                      | undefined;
                    const detail = payload?.project
                      ? `${payload.project} · ${payload.pageLabel ?? "Page"}`
                      : (payload?.pageLabel ?? "SEO score");
                    return [value, detail];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  name="SEO score"
                  stroke="#0f766e"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
