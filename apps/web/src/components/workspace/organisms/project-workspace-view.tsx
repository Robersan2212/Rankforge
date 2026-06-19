import { WorkspaceHeader } from "@/components/workspace/organisms/workspace-header";
import { ProjectMetricRow } from "@/components/workspace/organisms/metric-row";
import { SeoChartPanel } from "@/components/workspace/organisms/seo-chart-panel";
import { RecentActivityList } from "@/components/workspace/organisms/recent-activity-list";
import { EmptyState } from "@/components/workspace/molecules/empty-state";
import { SearchInput } from "@/components/workspace/molecules/search-input";
import { SECTION_CONFIG, type ProjectSection } from "@/lib/workspace";
import type { Project } from "@/lib/types";

interface ProjectWorkspaceViewProps {
  project: Project;
  section: ProjectSection;
}

export function ProjectWorkspaceView({
  project,
  section,
}: ProjectWorkspaceViewProps) {
  const sectionConfig = SECTION_CONFIG[section];

  return (
    <div className="space-y-8">
      <WorkspaceHeader
        title={project.name}
        subtitle={`/${project.slug}`}
        actions={
          <SearchInput
            value=""
            onChange={() => {}}
            placeholder="Search coming in FR-02"
            disabled
          />
        }
      />

      <ProjectMetricRow sectionLabel={sectionConfig.label} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SeoChartPanel
            title={`${sectionConfig.label} overview`}
            description={`Performance and trends for ${sectionConfig.label.toLowerCase()} will appear here (FR-02).`}
          />
        </div>
        <RecentActivityList
          emptyTitle={`No ${sectionConfig.label.toLowerCase()} yet`}
          emptyDescription={sectionConfig.description}
        />
      </div>

      <EmptyState
        icon={sectionConfig.icon}
        title={sectionConfig.label}
        description={sectionConfig.description}
      />
    </div>
  );
}
