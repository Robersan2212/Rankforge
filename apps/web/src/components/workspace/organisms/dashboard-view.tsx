"use client";

import { useMemo, useState } from "react";
import { FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewProjectModal } from "@/components/new-project-modal";
import { EmptyState } from "@/components/workspace/molecules/empty-state";
import { SearchInput } from "@/components/workspace/molecules/search-input";
import { DashboardMetricRow } from "@/components/workspace/organisms/metric-row";
import { RecentActivityList } from "@/components/workspace/organisms/recent-activity-list";
import { SeoChartPanel } from "@/components/workspace/organisms/seo-chart-panel";
import { WorkspaceHeader } from "@/components/workspace/organisms/workspace-header";
import type { Project, SeoPerformance, UserStats } from "@/lib/types";

interface DashboardViewProps {
  projects: Project[];
  stats: UserStats;
  seoPerformance: SeoPerformance;
  userEmail: string;
}

const EMPTY_SEO_PERFORMANCE: SeoPerformance = {
  points: [],
  summary: { audit_count: 0, average_score: null, latest_score: null },
};

export function DashboardView({
  projects,
  stats,
  seoPerformance = EMPTY_SEO_PERFORMANCE,
  userEmail,
}: DashboardViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        project.slug.toLowerCase().includes(query)
    );
  }, [projects, search]);

  if (projects.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col">
        <WorkspaceHeader
          title="Your workspaces"
          subtitle={userEmail}
          actions={
            <Button onClick={() => setModalOpen(true)}>New project</Button>
          }
        />
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create a workspace to isolate audits, briefs, drafts, and keywords."
          action={
            <Button onClick={() => setModalOpen(true)}>
              Create your first project
            </Button>
          }
          className="mt-8 flex-1"
        />
        <NewProjectModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <WorkspaceHeader
        title="Your workspaces"
        subtitle={userEmail}
        actions={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search projects"
          />
        }
      />

      <DashboardMetricRow projectCount={projects.length} stats={stats} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SeoChartPanel
            data={seoPerformance}
            firstProjectId={filteredProjects[0]?.id ?? projects[0]?.id}
          />
        </div>
        <RecentActivityList
          projects={filteredProjects}
          headerAction={
            <Button
              size="sm"
              className="rounded-full px-3.5"
              onClick={() => setModalOpen(true)}
            >
              New project
            </Button>
          }
        />
      </div>

      <NewProjectModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
