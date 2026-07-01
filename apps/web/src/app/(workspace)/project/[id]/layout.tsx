import { notFound, redirect } from "next/navigation";
import { fetchFromApi } from "@/lib/api-server";
import { getAuthenticatedUser } from "@/lib/server-auth";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: { id: string };
}

export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const res = await fetchFromApi(`/api/projects/${params.id}`);
  if (res.status === 404 || !res.ok) {
    notFound();
  }

  return children;
}
