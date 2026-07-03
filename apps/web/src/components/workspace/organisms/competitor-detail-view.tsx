import Link from "next/link";
import {
  CompetitorAnalysisReportView,
} from "@/components/workspace/organisms/competitor-analysis-report";
import { Badge } from "@/components/ui/badge";
import type { CompetitorAnalysis, Project } from "@/lib/types";
import { isCompetitorAnalysisReport } from "@/lib/types";

interface CompetitorDetailViewProps {
  project: Project;
  analysis: CompetitorAnalysis;
}

function statusVariant(
  status: CompetitorAnalysis["status"]
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed":
      return "default";
    case "partial":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

export function CompetitorDetailView({
  project,
  analysis,
}: CompetitorDetailViewProps) {
  const report = isCompetitorAnalysisReport(analysis.report)
    ? analysis.report
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0">
          <Link
            href={`/project/${project.id}/competitors`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to competitors
          </Link>
          <h1 className="text-xl font-semibold">{analysis.keyword}</h1>
          <p className="text-sm text-muted-foreground break-all">
            {analysis.user_page_url}
          </p>
          <p className="text-sm text-muted-foreground">
            {project.name} ·{" "}
            {analysis.completed_at
              ? `Completed ${new Date(analysis.completed_at).toLocaleString()}`
              : `Started ${new Date(analysis.created_at).toLocaleString()}`}
          </p>
        </div>
        <Badge variant={statusVariant(analysis.status)}>{analysis.status}</Badge>
      </div>

      {analysis.status === "partial" && report && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          Partial results: {report.results_returned} of{" "}
          {report.results_requested} competitor pages analyzed successfully.
        </div>
      )}

      {analysis.error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {analysis.error}
        </div>
      )}

      {report ? (
        <div className="rounded-2xl border border-border bg-card p-6">
          <CompetitorAnalysisReportView report={report} />
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            {analysis.status === "pending" || analysis.status === "running"
              ? "Analysis in progress… refresh or wait for completion."
              : "No report data available for this analysis."}
          </p>
        </div>
      )}
    </div>
  );
}
