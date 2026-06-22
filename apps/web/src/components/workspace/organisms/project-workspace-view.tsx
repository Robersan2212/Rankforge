import { ProjectMetricRow } from "@/components/workspace/organisms/metric-row";
import { ProjectResourcePanel } from "@/components/workspace/organisms/project-resource-panel";
import { WorkspaceHeader } from "@/components/workspace/organisms/workspace-header";
import { SECTION_CONFIG, type ProjectSection } from "@/lib/workspace";
import type {
  Audit,
  Brief,
  Draft,
  Project,
  ProjectStats,
  TrackedKeyword,
} from "@/lib/types";

interface ProjectWorkspaceViewProps {
  project: Project;
  section: ProjectSection;
  items: Audit[] | Brief[] | Draft[] | TrackedKeyword[];
  stats: ProjectStats;
}

export function ProjectWorkspaceView({
  project,
  section,
  items,
  stats,
}: ProjectWorkspaceViewProps) {
  const sectionConfig = SECTION_CONFIG[section];

  return (
    <div className="space-y-8">
      <WorkspaceHeader
        title={project.name}
        subtitle={`/${project.slug} · ${sectionConfig.label}`}
      />

      <ProjectMetricRow stats={stats} sectionLabel={sectionConfig.label} />

      <ProjectResourcePanel
        projectId={project.id}
        section={section}
        items={items}
      />
    </div>
  );
}
