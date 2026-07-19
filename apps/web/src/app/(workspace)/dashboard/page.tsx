import { DashboardView } from "@/components/workspace/organisms/dashboard-view";
import { PageLoading } from "@/components/workspace/molecules/page-loading";
import { PageReveal } from "@/components/workspace/molecules/page-reveal";
import { DashboardSkeleton } from "@/components/workspace/molecules/page-skeletons";
import { fetchFromApi } from "@/lib/api-server";
import { LOADING_LABELS } from "@/lib/page-loading";
import { getAuthenticatedUser } from "@/lib/server-auth";
import type { Project, SeoPerformance, UserStats } from "@/lib/types";

export const dynamic = "force-dynamic";

const EMPTY_STATS: UserStats = {
  projects: 0,
  audits: 0,
  briefs: 0,
  drafts: 0,
  keywords: 0,
};

const EMPTY_SEO_PERFORMANCE: SeoPerformance = {
  points: [],
  summary: { audit_count: 0, average_score: null, latest_score: null },
};

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();

  let projects: Project[] = [];
  let stats: UserStats = EMPTY_STATS;
  let seoPerformance: SeoPerformance = EMPTY_SEO_PERFORMANCE;

  try {
    const [projectsRes, statsRes, seoRes] = await Promise.all([
      fetchFromApi("/api/projects"),
      fetchFromApi("/api/projects/stats"),
      fetchFromApi("/api/projects/seo-performance"),
    ]);
    if (projectsRes.ok) {
      projects = await projectsRes.json();
    }
    if (statsRes.ok) {
      stats = await statsRes.json();
    }
    if (seoRes.ok) {
      seoPerformance = await seoRes.json();
    }
  } catch {
    projects = [];
    stats = EMPTY_STATS;
    seoPerformance = EMPTY_SEO_PERFORMANCE;
  }

  return (
    <PageReveal
      fallback={
        <PageLoading label={LOADING_LABELS.dashboard}>
          <DashboardSkeleton />
        </PageLoading>
      }
    >
      <DashboardView
        projects={projects}
        stats={stats}
        seoPerformance={seoPerformance}
        userEmail={user?.email ?? "Signed in"}
      />
    </PageReveal>
  );
}
