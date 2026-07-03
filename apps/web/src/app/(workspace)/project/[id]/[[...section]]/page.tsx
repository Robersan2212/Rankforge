import { notFound, redirect } from "next/navigation";
import { AuditDetailView } from "@/components/workspace/organisms/audit-detail-view";
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
  Draft,
  Project,
  ProjectStats,
  TrackedKeyword,
} from "@/lib/types";

export const dynamic = "force-dynamic";

interface ProjectSectionPageProps {
  params: { id: string; section?: string[] };
}

const EMPTY_PROJECT_STATS: ProjectStats = {
  audits: 0,
  briefs: 0,
  drafts: 0,
  keywords: 0,
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

    return <AuditDetailView project={project} audit={audit} />;
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

  return (
    <ProjectWorkspaceView
      project={project}
      section={sectionParam}
      items={items as Audit[] | Brief[] | Draft[] | TrackedKeyword[]}
      stats={stats}
    />
  );
}
