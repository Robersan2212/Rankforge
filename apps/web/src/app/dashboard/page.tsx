import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard-client";
import { fetchFromApi } from "@/lib/api-server";
import { getAuthenticatedUser } from "@/lib/server-auth";
import type { Project } from "@/lib/types";

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

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
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-10 sm:px-6">
      <DashboardClient
        projects={projects}
        userEmail={user.email ?? "Signed in"}
      />
    </main>
  );
}
