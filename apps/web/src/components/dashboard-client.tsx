"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NewProjectModal } from "@/components/new-project-modal";
import type { Project } from "@/lib/types";

interface DashboardClientProps {
  projects: Project[];
  userEmail: string;
}

export function DashboardClient({ projects, userEmail }: DashboardClientProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-primary">
            RANKFORGE
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{userEmail}</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>New project</Button>
      </header>

      {projects.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No projects yet</CardTitle>
            <CardDescription>
              Create a workspace to isolate audits, briefs, drafts, and keywords.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setModalOpen(true)}>Create your first project</Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link href={`/project/${project.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader>
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription>/{project.slug}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <NewProjectModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
