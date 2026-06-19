import { DashboardView } from "@/components/workspace/organisms/dashboard-view";
import { fetchFromApi } from "@/lib/api-server";
import { getAuthenticatedUser } from "@/lib/server-auth";
import type { Project } from "@/lib/types";

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();

  let projects: Project[] = [];
  try {
    const res = await fetchFromApi("/api/projects");
    if (res.ok) {
      projects = await res.json();
    }
  } catch {
    projects = [];
  }

  return (
    <DashboardView
      projects={projects}
      userEmail={user?.email ?? "Signed in"}
    />
  );
}
