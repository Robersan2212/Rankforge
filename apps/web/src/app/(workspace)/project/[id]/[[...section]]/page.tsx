import { notFound, redirect } from "next/navigation";
import { AuditDetailView } from "@/components/workspace/organisms/audit-detail-view";
import { BriefDetailView } from "@/components/workspace/organisms/brief-detail-view";
import { CompetitorDetailView } from "@/components/workspace/organisms/competitor-detail-view";
import { DraftEditorView } from "@/components/editor/draft-editor-view";
import { ProjectPageReveal } from "@/components/workspace/molecules/project-page-reveal";
import { ProjectWorkspaceView } from "@/components/workspace/organisms/project-workspace-view";
import { fetchFromApi, fetchProject } from "@/lib/api-server";
import {
  SECTION_API_PATH,
  isProjectSection,
  type ProjectSection,
} from "@/lib/workspace";
import type {
  Audit,
  Brief,
  CompetitorAnalysis,
  Draft,
  Project,
  ProjectStats,
  TrackedKeyword,
} from "@/lib/types";

export const dynamic = "force-dynamic";

interface ProjectSectionPageProps {
  params: { id: string; section?: string[] };
  searchParams?: { briefId?: string };
}

const EMPTY_PROJECT_STATS: ProjectStats = {
  audits: 0,
  briefs: 0,
  drafts: 0,
  keywords: 0,
  competitors: 0,
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function fetchSectionItems(projectId: string, section: ProjectSection) {
  const res = await fetchFromApi(
    `/api/projects/${projectId}/${SECTION_API_PATH[section]}`
  );
  if (!res.ok) {
    return [];
  }
  return res.json();
}

async function loadProject(projectId: string): Promise<Project> {
  const projectRes = await fetchProject(projectId);
  if (projectRes.status === 404 || !projectRes.ok) {
    notFound();
  }
  return projectRes.json();
}

export default async function ProjectSectionPage({
  params,
  searchParams,
}: ProjectSectionPageProps) {
  const sectionParts = params.section ?? [];
  const sectionParam = sectionParts[0];

  if (!sectionParam) {
    redirect(`/project/${params.id}/audits`);
  }

  if (sectionParam === "audits" && sectionParts[1]) {
    const auditId = sectionParts[1];
    if (!UUID_RE.test(auditId)) {
      notFound();
    }

    const [projectRes, auditRes] = await Promise.all([
      fetchProject(params.id),
      fetchFromApi(`/api/projects/${params.id}/audits/${auditId}`),
    ]);

    if (projectRes.status === 404 || !projectRes.ok) {
      notFound();
    }
    if (auditRes.status === 401) {
      redirect("/login");
    }
    if (auditRes.status === 404 || !auditRes.ok) {
      notFound();
    }

    const [project, audit]: [Project, Audit] = await Promise.all([
      projectRes.json(),
      auditRes.json(),
    ]);

    return (
      <ProjectPageReveal kind="audit">
        <AuditDetailView project={project} audit={audit} />
      </ProjectPageReveal>
    );
  }

  if (sectionParam === "briefs" && sectionParts[1]) {
    const briefId = sectionParts[1];
    if (!UUID_RE.test(briefId)) {
      notFound();
    }

    const [projectRes, briefRes] = await Promise.all([
      fetchProject(params.id),
      fetchFromApi(`/api/projects/${params.id}/briefs/${briefId}`),
    ]);

    if (projectRes.status === 404 || !projectRes.ok) {
      notFound();
    }
    if (briefRes.status === 401) {
      redirect("/login");
    }
    if (briefRes.status === 404 || !briefRes.ok) {
      notFound();
    }

    const [project, brief]: [Project, Brief] = await Promise.all([
      projectRes.json(),
      briefRes.json(),
    ]);

    return (
      <ProjectPageReveal kind="brief">
        <BriefDetailView project={project} brief={brief} />
      </ProjectPageReveal>
    );
  }

  if (sectionParam === "competitors" && sectionParts[1]) {
    const analysisId = sectionParts[1];
    if (!UUID_RE.test(analysisId)) {
      notFound();
    }

    const [projectRes, analysisRes] = await Promise.all([
      fetchProject(params.id),
      fetchFromApi(
        `/api/projects/${params.id}/competitor-analyses/${analysisId}`
      ),
    ]);

    if (projectRes.status === 404 || !projectRes.ok) {
      notFound();
    }
    if (analysisRes.status === 401) {
      redirect("/login");
    }
    if (analysisRes.status === 404 || !analysisRes.ok) {
      notFound();
    }

    const [project, analysis]: [Project, CompetitorAnalysis] =
      await Promise.all([projectRes.json(), analysisRes.json()]);

    return (
      <ProjectPageReveal kind="competitor">
        <CompetitorDetailView project={project} analysis={analysis} />
      </ProjectPageReveal>
    );
  }

  if (sectionParam === "editor" && sectionParts[1]) {
    const draftId = sectionParts[1];
    if (!UUID_RE.test(draftId)) {
      notFound();
    }

    const [projectRes, draftRes, briefsRes] = await Promise.all([
      fetchProject(params.id),
      fetchFromApi(`/api/projects/${params.id}/drafts/${draftId}`),
      fetchFromApi(`/api/projects/${params.id}/briefs`),
    ]);

    if (projectRes.status === 404 || !projectRes.ok) {
      notFound();
    }
    if (draftRes.status === 401) {
      redirect("/login");
    }
    if (draftRes.status === 404 || !draftRes.ok) {
      notFound();
    }

    const [project, draft]: [Project, Draft] = await Promise.all([
      projectRes.json(),
      draftRes.json(),
    ]);
    const briefs: Brief[] = briefsRes.ok ? await briefsRes.json() : [];

    return (
      <ProjectPageReveal kind="editor">
        <DraftEditorView
          project={project}
          draft={draft}
          briefs={briefs}
          initialBriefId={searchParams?.briefId ?? draft.brief_id}
        />
      </ProjectPageReveal>
    );
  }

  if (sectionParts.length > 1) {
    notFound();
  }

  if (!isProjectSection(sectionParam)) {
    notFound();
  }

  const [project, statsRes, items] = await Promise.all([
    loadProject(params.id),
    fetchFromApi(`/api/projects/${params.id}/stats`),
    fetchSectionItems(params.id, sectionParam),
  ]);

  const stats: ProjectStats = statsRes.ok
    ? await statsRes.json()
    : EMPTY_PROJECT_STATS;

  let audits: Audit[] = [];
  let competitorAnalyses: CompetitorAnalysis[] = [];

  if (sectionParam === "briefs") {
    const [auditsRes, competitorsRes] = await Promise.all([
      fetchFromApi(`/api/projects/${params.id}/audits`),
      fetchFromApi(`/api/projects/${params.id}/competitor-analyses`),
    ]);
    audits = auditsRes.ok ? await auditsRes.json() : [];
    competitorAnalyses = competitorsRes.ok ? await competitorsRes.json() : [];
  }

  return (
    <ProjectPageReveal kind="section">
      <ProjectWorkspaceView
        project={project}
        section={sectionParam}
        items={
          items as
            | Audit[]
            | Brief[]
            | Draft[]
            | TrackedKeyword[]
            | CompetitorAnalysis[]
        }
        stats={stats}
        audits={audits}
        competitorAnalyses={competitorAnalyses}
      />
    </ProjectPageReveal>
  );
}
