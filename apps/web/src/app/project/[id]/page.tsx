import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchFromApi } from "@/lib/api-server";
import { getAuthenticatedUser } from "@/lib/server-auth";
import type { Project } from "@/lib/types";

interface ProjectPageProps {
  params: { id: string };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const res = await fetchFromApi(`/api/projects/${params.id}`);
  if (res.status === 404) {
    notFound();
  }
  if (!res.ok) {
    notFound();
  }

  const project: Project = await res.json();

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="outline" size="sm">
            ← Dashboard
          </Button>
        </Link>
      </div>

      <h1 className="text-2xl font-semibold">{project.name}</h1>
      <p className="text-sm text-muted-foreground">/{project.slug}</p>

      <Tabs defaultValue="audits" className="mt-8">
        <TabsList>
          <TabsTrigger value="audits">Audits</TabsTrigger>
          <TabsTrigger value="briefs">Briefs</TabsTrigger>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
        </TabsList>
        <TabsContent value="audits" className="mt-4">
          <p className="text-sm text-muted-foreground">
            SEO page audits (FR-02) will appear here.
          </p>
        </TabsContent>
        <TabsContent value="briefs" className="mt-4">
          <p className="text-sm text-muted-foreground">
            Content briefs — coming in a later phase.
          </p>
        </TabsContent>
        <TabsContent value="editor" className="mt-4">
          <p className="text-sm text-muted-foreground">
            Draft editor — coming in a later phase.
          </p>
        </TabsContent>
        <TabsContent value="keywords" className="mt-4">
          <p className="text-sm text-muted-foreground">
            Tracked keywords — coming in a later phase.
          </p>
        </TabsContent>
      </Tabs>
    </main>
  );
}
