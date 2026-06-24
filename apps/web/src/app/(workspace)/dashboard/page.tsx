import { DashboardView } from "@/components/workspace/organisms/dashboard-view";
import { fetchFromApi } from "@/lib/api-server";
import { getAuthenticatedUser } from "@/lib/server-auth";
import type { Project, UserStats } from "@/lib/types";

export const dynamic = "force-dynamic";

const EMPTY_STATS: UserStats = {
  projects: 0,
  audits: 0,
  briefs: 0,
  drafts: 0,
  keywords: 0,
};

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();

  let projects: Project[] = [];
  let stats: UserStats = EMPTY_STATS;

  try {
    const [projectsRes, statsRes] = await Promise.all([
      fetchFromApi("/api/projects"),
      fetchFromApi("/api/projects/stats"),
    ]);
    if (projectsRes.ok) {
      projects = await projectsRes.json();
    }
    if (statsRes.ok) {
      stats = await statsRes.json();
    }
  } catch {
    projects = [];
    stats = EMPTY_STATS;
  }

  return (
    <DashboardView
      projects={projects}
      stats={stats}
      userEmail={user?.email ?? "Signed in"}
    />
  );
}
