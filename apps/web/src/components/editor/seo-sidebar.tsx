"use client";

import { Badge } from "@/components/ui/badge";
import type { SeoMetrics } from "@/lib/seo-metrics";

interface SeoSidebarProps {
  metrics: SeoMetrics;
  primaryKeyword: string;
}

function MetricCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">
        {title}
      </p>
      {children}
    </div>
  );
}

const HEADING_LABELS = ["H1", "H2", "H3", "H4", "H5", "H6"] as const;

export function SeoSidebar({ metrics, primaryKeyword }: SeoSidebarProps) {
  const { wordCount, keywords, headings, readability } = metrics;
  const progressValue = wordCount.target
    ? Math.min(100, wordCount.percentOfTarget ?? 0)
    : undefined;

  return (
    <aside className="space-y-4">
      <MetricCard title="Keyword usage">
        {primaryKeyword ? (
          <div className="space-y-3">
            {keywords.primary && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {keywords.primary.keyword}
                </span>
                <Badge variant="default">{keywords.primary.count}</Badge>
              </div>
            )}
            {keywords.semantic.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Semantic</p>
                {keywords.semantic.map((item) => (
                  <div
                    key={item.keyword}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="truncate">{item.keyword}</span>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Total occurrences: {keywords.totalOccurrences}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Link a brief or enter a primary keyword to track usage.
          </p>
        )}
      </MetricCard>

      <MetricCard title="Word count">
        <div className="space-y-2">
          <p className="text-2xl font-semibold">
            {wordCount.current.toLocaleString()}
            {wordCount.target !== undefined && (
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                / {wordCount.target.toLocaleString()}
              </span>
            )}
          </p>
          {wordCount.target !== undefined && (
            <div className="space-y-1">
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progressValue ?? 0}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {wordCount.percentOfTarget ?? 0}% of target
              </p>
            </div>
          )}
        </div>
      </MetricCard>

      <MetricCard title="Heading structure">
        <div className="flex flex-wrap gap-2">
          {HEADING_LABELS.map((label, index) => {
            const key = `h${index + 1}` as keyof typeof headings.counts;
            const count = headings.counts[key];
            return (
              <Badge key={label} variant={count > 0 ? "secondary" : "outline"}>
                {label}: {count}
              </Badge>
            );
          })}
        </div>
        {headings.warnings.length > 0 ? (
          <ul className="space-y-1 text-xs text-amber-600 dark:text-amber-400">
            {headings.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : headings.counts.total > 0 ? (
          <p className="text-xs text-green-600 dark:text-green-400">
            Heading structure looks good.
          </p>
        ) : null}
      </MetricCard>

      <MetricCard title="Readability">
        <p className="text-2xl font-semibold">{readability.score}</p>
        <p className="text-sm text-muted-foreground">{readability.label}</p>
        <p className="text-xs text-muted-foreground">
          Flesch Reading Ease (higher = easier)
        </p>
      </MetricCard>
    </aside>
  );
}
