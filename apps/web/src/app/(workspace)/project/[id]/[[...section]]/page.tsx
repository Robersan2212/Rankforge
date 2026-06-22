import { notFound, redirect } from "next/navigation";
import { ProjectWorkspaceView } from "@/components/workspace/organisms/project-workspace-view";
import { fetchFromApi } from "@/lib/api-server";
import { getAuthenticatedUser } from "@/lib/server-auth";
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

interface ProjectSectionPageProps {
  params: { id: string; section?: string[] };
}

const EMPTY_PROJECT_STATS: ProjectStats = {
  audits: 0,
  briefs: 0,
  drafts: 0,
  keywords: 0,
};

async function fetchSectionItems(projectId: string, section: ProjectSection) {
  const res = await fetchFromApi(
    `/api/projects/${projectId}/${SECTION_API_PATH[section]}`
  );
  if (!res.ok) {
    return [];
  }
  return res.json();
}

export default async function ProjectSectionPage({
  params,
}: ProjectSectionPageProps) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const sectionParam = params.section?.[0];

  if (!sectionParam) {
    redirect(`/project/${params.id}/audits`);
  }

  if (!isProjectSection(sectionParam)) {
    notFound();
  }

  const [projectRes, statsRes, items] = await Promise.all([
    fetchFromApi(`/api/projects/${params.id}`),
    fetchFromApi(`/api/projects/${params.id}/stats`),
    fetchSectionItems(params.id, sectionParam),
  ]);

  if (projectRes.status === 404 || !projectRes.ok) {
    notFound();
  }

  const project: Project = await projectRes.json();
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
