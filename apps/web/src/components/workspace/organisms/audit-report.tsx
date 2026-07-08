import type { AuditReport } from "@/lib/types";
import { ScoreBar } from "@/components/ui/score-bar";

interface AuditReportViewProps {
  report: AuditReport;
}

export function AuditReportView({ report }: AuditReportViewProps) {
  const breakdown = report.score_breakdown;
  const categories = breakdown
    ? [
        { key: "Title", ...breakdown.title },
        { key: "Description", ...breakdown.description },
        { key: "Headings", ...breakdown.headings },
        { key: "Content", ...breakdown.content_length },
        { key: "Links", ...breakdown.links },
        { key: "Images", ...breakdown.images },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted text-2xl font-semibold tabular-nums">
          {report.seo_score}
        </div>
        <div>
          <p className="text-sm font-medium">SEO score</p>
          <p className="text-xs text-muted-foreground">Out of 100</p>
        </div>
      </div>

      {categories.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium">Score breakdown</h3>
          <div className="space-y-3">
            {categories.map((cat) => (
              <div key={cat.key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{cat.key}</span>
                </div>
                <ScoreBar score={cat.score} max={cat.max} />
                <p className="text-xs text-muted-foreground">{cat.notes}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Meta title</p>
          <p className="text-sm font-medium break-words">
            {report.meta_title ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {report.meta_title_length} characters
          </p>
        </div>
        <div className="rounded-xl border border-border p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Meta description</p>
          <p className="text-sm break-words">
            {report.meta_description ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {report.meta_description_length} characters
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Headings</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["h1", "h2", "h3", "h4", "h5", "h6"] as const).map((level) => {
            const items = report.headings[level];
            if (!items?.length) return null;
            return (
              <div
                key={level}
                className="rounded-xl border border-border p-3 space-y-1"
              >
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  {level}
                </p>
                <ul className="text-sm space-y-1">
                  {items.map((text, i) => (
                    <li key={i} className="break-words">
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Word count</p>
          <p className="text-lg font-semibold tabular-nums">
            {report.word_count}
          </p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Links</p>
          <p className="text-sm">
            {report.links.internal_count} internal ·{" "}
            {report.links.external_count} external
          </p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Images</p>
          <p className="text-sm">
            {report.images.total} total · {report.images.missing_alt_count}{" "}
            missing alt
          </p>
        </div>
      </section>

      {report.errors.length > 0 && (
        <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">Warnings</p>
          <ul className="mt-2 text-sm space-y-1">
            {report.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function isAuditReport(results: unknown): results is AuditReport {
  return (
    typeof results === "object" &&
    results !== null &&
    "seo_score" in results &&
    "score_breakdown" in results
  );
}

export { isAuditReport };
