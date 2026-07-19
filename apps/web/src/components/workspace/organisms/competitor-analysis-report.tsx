import { Badge } from "@/components/ui/badge";
import type {
  CompetitorAnalysisReport,
  CompetitorPage,
  ContentGap,
  HeadingsByLevel,
} from "@/lib/types";

function StatusBadge({ status, reason }: { status: string; reason?: string }) {
  const variant =
    status === "ok"
      ? "default"
      : status === "skipped"
        ? "secondary"
        : "destructive";
  const label = reason ? `${status} (${reason})` : status;
  return <Badge variant={variant}>{label}</Badge>;
}

function HeadingsPreview({ headings }: { headings: HeadingsByLevel }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {(["h1", "h2", "h3"] as const).map((level) => {
        const items = headings[level];
        if (!items?.length) return null;
        return (
          <div
            key={level}
            className="rounded-lg border border-border p-2 space-y-1"
          >
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {level}
            </p>
            <ul className="text-xs space-y-0.5">
              {items.slice(0, 4).map((text, i) => (
                <li key={i} className="break-words line-clamp-2">
                  {text}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function CompetitorRow({ competitor }: { competitor: CompetitorPage }) {
  const isOk = competitor.status === "ok";

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            {competitor.rank_position != null && (
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                #{competitor.rank_position}
              </span>
            )}
            <StatusBadge
              status={competitor.status}
              reason={competitor.reason}
            />
          </div>
          <a
            href={competitor.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium break-all hover:underline"
          >
            {competitor.url}
          </a>
        </div>
        {isOk && competitor.word_count != null && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Word count</p>
            <p className="text-lg font-semibold tabular-nums">
              {competitor.word_count}
            </p>
          </div>
        )}
      </div>

      {isOk && competitor.headings && (
        <HeadingsPreview headings={competitor.headings} />
      )}

      {isOk && competitor.topics_covered && competitor.topics_covered.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {competitor.topics_covered.slice(0, 8).map((topic) => (
            <Badge key={topic} variant="outline" className="text-xs">
              {topic}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function ContentGapSection({ gap }: { gap: ContentGap }) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-medium">Content gap</h3>
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
        <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
          Topics competitors cover that your page may be missing
        </p>
        {gap.topics_missing_from_user_page.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {gap.topics_missing_from_user_page.map((topic) => (
              <Badge
                key={topic}
                className="bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
              >
                {topic}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No significant gaps detected.
          </p>
        )}
      </div>
      {gap.topics_user_page_shares.length > 0 && (
        <div className="rounded-xl border border-border p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Topics your page already shares with competitors
          </p>
          <div className="flex flex-wrap gap-1.5">
            {gap.topics_user_page_shares.map((topic) => (
              <Badge key={topic} variant="secondary">
                {topic}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

interface CompetitorAnalysisReportViewProps {
  report: CompetitorAnalysisReport;
}

export function CompetitorAnalysisReportView({
  report,
}: CompetitorAnalysisReportViewProps) {
  const okCount = report.results_returned;
  const requested = report.results_requested;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Keyword</p>
          <p className="text-lg font-semibold">{report.keyword}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Results for</p>
          <p className="text-lg font-semibold">
            {report.location_applied?.trim()
              ? report.location_applied
              : "Global results"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Results</p>
          <p className="text-lg font-semibold tabular-nums">
            {okCount}/{requested} succeeded
          </p>
        </div>
      </div>

      {report.note && (
        <p className="text-sm text-amber-700 dark:text-amber-300" role="status">
          {report.note}
        </p>
      )}

      <p className="text-sm text-muted-foreground break-all">
        Your page: {report.user_page_url}
      </p>

      <ContentGapSection gap={report.content_gap} />

      <section className="space-y-3">
        <h3 className="text-sm font-medium">Competitor pages</h3>
        <div className="space-y-3">
          {report.competitors.map((competitor) => (
            <CompetitorRow
              key={`${competitor.rank_position}-${competitor.url}`}
              competitor={competitor}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
