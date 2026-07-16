import Link from "next/link";
import { AuditDeleteButton } from "@/components/workspace/molecules/audit-delete-button";
import { AuditReportView, isAuditReport } from "@/components/workspace/organisms/audit-report";
import { GscMetricsPanel } from "@/components/workspace/organisms/gsc-metrics-panel";
import type { Audit, AuditReport, Project } from "@/lib/types";
import { getAuditPayload } from "@/lib/types";
import { formatShortDateTime } from "@/lib/format-date";

interface AuditDetailViewProps {
  project: Project;
  audit: Audit;
}

export function AuditDetailView({ project, audit }: AuditDetailViewProps) {
  const payload = getAuditPayload(audit);
  const report = isAuditReport(payload) ? payload : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0">
          <Link
            href={`/project/${project.id}/audits`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to audits
          </Link>
          <h1 className="text-xl font-semibold truncate">{audit.url}</h1>
          <p className="text-sm text-muted-foreground">
            {project.name} · Audited{" "}
            {formatShortDateTime(audit.fetched_at ?? audit.created_at)}
          </p>
        </div>
        <AuditDeleteButton
          projectId={project.id}
          auditId={audit.id}
          redirectTo={`/project/${project.id}/audits`}
          variant="button"
        />
      </div>

      {report ? (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
          <AuditReportView report={report} />
          <GscMetricsPanel
            projectId={project.id}
            auditedUrl={audit.url}
            metrics={(report as AuditReport).gsc_metrics}
            connection={(report as AuditReport).gsc_connection}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-2">
          <p className="text-sm font-medium">No report data for this audit</p>
          <p className="text-sm text-muted-foreground">
            This audit was saved before the auditor was fully wired up, or the
            crawl did not complete. Run the audit again from the audits list.
          </p>
        </div>
      )}
    </div>
  );
}
