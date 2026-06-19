import { FileText, FolderKanban, Search, Tags } from "lucide-react";
import { MetricCard } from "@/components/workspace/molecules/metric-card";

interface DashboardMetricRowProps {
  projectCount: number;
}

export function DashboardMetricRow({ projectCount }: DashboardMetricRowProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Projects"
        value={projectCount}
        delta="Active workspaces"
        variant="lavender"
        icon={FolderKanban}
      />
      <MetricCard
        label="Audits"
        value={0}
        delta="No data yet"
        variant="blue"
        icon={Search}
      />
      <MetricCard
        label="Briefs"
        value={0}
        delta="No data yet"
        icon={FileText}
      />
      <MetricCard
        label="Keywords"
        value={0}
        delta="No data yet"
        icon={Tags}
      />
    </div>
  );
}

interface ProjectMetricRowProps {
  sectionLabel?: string;
}

export function ProjectMetricRow({ sectionLabel }: ProjectMetricRowProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Audits"
        value={0}
        delta="No data yet"
        variant="lavender"
        icon={Search}
      />
      <MetricCard
        label="Briefs"
        value={0}
        delta="No data yet"
        variant="blue"
        icon={FileText}
      />
      <MetricCard
        label="Drafts"
        value={0}
        delta="No data yet"
        icon={FileText}
      />
      <MetricCard
        label="Keywords"
        value={0}
        delta={sectionLabel ? `Viewing ${sectionLabel}` : "No data yet"}
        icon={Tags}
      />
    </div>
  );
}
