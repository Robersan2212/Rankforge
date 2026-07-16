import { BriefGenerationPanel } from "@/components/workspace/organisms/brief-generation-panel";
import { EditorDraftPanel } from "@/components/workspace/organisms/editor-draft-panel";
import { KeywordTrackerPanel } from "@/components/workspace/organisms/keyword-tracker-panel";
import { ProjectMetricRow } from "@/components/workspace/organisms/metric-row";
import { CompetitorAnalysisPanel } from "@/components/workspace/organisms/competitor-analysis-panel";
import { GscIntegrationPanel } from "@/components/workspace/organisms/gsc-integration-panel";
import { ProjectResourcePanel } from "@/components/workspace/organisms/project-resource-panel";
import { WorkspaceHeader } from "@/components/workspace/organisms/workspace-header";
import { SECTION_CONFIG, type ProjectSection } from "@/lib/workspace";
import type {
  Audit,
  Brief,
  CompetitorAnalysis,
  Draft,
  Project,
  ProjectStats,
  TrackedKeyword,
} from "@/lib/types";

interface ProjectWorkspaceViewProps {
  project: Project;
  section: ProjectSection;
  items: Audit[] | Brief[] | Draft[] | TrackedKeyword[] | CompetitorAnalysis[];
  stats: ProjectStats;
  audits?: Audit[];
  competitorAnalyses?: CompetitorAnalysis[];
}

export function ProjectWorkspaceView({
  project,
  section,
  items,
  stats,
  audits = [],
  competitorAnalyses = [],
}: ProjectWorkspaceViewProps) {
  const sectionConfig = SECTION_CONFIG[section];

  return (
    <div className="space-y-8">
      <WorkspaceHeader
        title={project.name}
        subtitle={`/${project.slug} · ${sectionConfig.label}`}
      />

      <ProjectMetricRow stats={stats} sectionLabel={sectionConfig.label} />

      {section === "audits" && (
        <GscIntegrationPanel projectId={project.id} />
      )}

      {section === "briefs" ? (
        <BriefGenerationPanel
          projectId={project.id}
          briefs={items as Brief[]}
          audits={audits}
          competitorAnalyses={competitorAnalyses}
        />
      ) : section === "competitors" ? (
        <CompetitorAnalysisPanel
          projectId={project.id}
          items={items as CompetitorAnalysis[]}
        />
      ) : section === "editor" ? (
        <EditorDraftPanel
          projectId={project.id}
          drafts={items as Draft[]}
        />
      ) : section === "keywords" ? (
        <KeywordTrackerPanel
          projectId={project.id}
          items={items as TrackedKeyword[]}
        />
      ) : (
        <ProjectResourcePanel
          projectId={project.id}
          section={section}
          items={items as Audit[] | Brief[] | Draft[] | TrackedKeyword[]}
        />
      )}
    </div>
  );
}
