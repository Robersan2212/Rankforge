import { BarChart2, FileText, FolderKanban, Search, Tags } from "lucide-react";
import { MetricCard } from "@/components/workspace/molecules/metric-card";
import type { ProjectStats, UserStats } from "@/lib/types";

interface DashboardMetricRowProps {
  projectCount: number;
  stats: UserStats;
}

export function DashboardMetricRow({
  projectCount,
  stats,
}: DashboardMetricRowProps) {
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
        value={stats.audits}
        delta={stats.audits === 0 ? "No data yet" : "Across all projects"}
        variant="blue"
        icon={Search}
      />
      <MetricCard
        label="Briefs"
        value={stats.briefs}
        delta={stats.briefs === 0 ? "No data yet" : "Across all projects"}
        icon={FileText}
      />
      <MetricCard
        label="Keywords"
        value={stats.keywords}
        delta={stats.keywords === 0 ? "No data yet" : "Across all projects"}
        icon={Tags}
      />
    </div>
  );
}

interface ProjectMetricRowProps {
  stats: ProjectStats;
  sectionLabel?: string;
}

export function ProjectMetricRow({ stats, sectionLabel }: ProjectMetricRowProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      <MetricCard
        label="Audits"
        value={stats.audits}
        delta={stats.audits === 0 ? "No data yet" : "In this project"}
        variant="lavender"
        icon={Search}
      />
      <MetricCard
        label="Competitors"
        value={stats.competitors ?? 0}
        delta={
          (stats.competitors ?? 0) === 0 ? "No data yet" : "In this project"
        }
        variant="blue"
        icon={BarChart2}
      />
      <MetricCard
        label="Briefs"
        value={stats.briefs}
        delta={stats.briefs === 0 ? "No data yet" : "In this project"}
        icon={FileText}
      />
      <MetricCard
        label="Drafts"
        value={stats.drafts}
        delta={stats.drafts === 0 ? "No data yet" : "In this project"}
        icon={FileText}
      />
      <MetricCard
        label="Keywords"
        value={stats.keywords}
        delta={sectionLabel ? `Viewing ${sectionLabel}` : "In this project"}
        icon={Tags}
      />
    </div>
  );
}
