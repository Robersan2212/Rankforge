import { notFound, redirect } from "next/navigation";
import { ProjectWorkspaceView } from "@/components/workspace/organisms/project-workspace-view";
import { fetchFromApi } from "@/lib/api-server";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { isProjectSection } from "@/lib/workspace";
import type { Project } from "@/lib/types";

interface ProjectSectionPageProps {
  params: { id: string; section?: string[] };
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

  const res = await fetchFromApi(`/api/projects/${params.id}`);
  if (res.status === 404 || !res.ok) {
    notFound();
  }

  const project: Project = await res.json();

  return <ProjectWorkspaceView project={project} section={sectionParam} />;
}
