"use client";

import { useState, type ReactNode } from "react";
import type { Project } from "@/lib/types";
import { ListRow } from "@/components/workspace/molecules/list-row";
import { EmptyState } from "@/components/workspace/molecules/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { FolderKanban } from "lucide-react";

interface RecentActivityListProps {
  projects?: Project[];
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  /** Rendered at the top-right of the panel header (e.g. New project). */
  headerAction?: ReactNode;
}

export function RecentActivityList({
  projects = [],
  emptyTitle = "No recent activity",
  emptyDescription = "Activity from audits, briefs, and keywords will show here.",
  className,
  headerAction,
}: RecentActivityListProps) {
  const [tab, setTab] = useState<"projects" | "activity">("projects");

  return (
    <div className={cn("flex flex-col rounded-2xl ring-1 ring-border", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={() => setTab("projects")}
            className={cn(
              "text-sm transition-colors",
              tab === "projects"
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Projects
          </button>
          <button
            type="button"
            onClick={() => setTab("activity")}
            className={cn(
              "text-sm transition-colors",
              tab === "activity"
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Activity
          </button>
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>

      <ScrollArea className="h-[320px]">
        <div className="space-y-1 p-3">
          {tab === "projects" ? (
            projects.length > 0 ? (
              projects.map((project) => (
                <ListRow
                  key={project.id}
                  href={`/project/${project.id}/audits`}
                  title={project.name}
                  subtitle={`/${project.slug}`}
                  badge="Open"
                  initials={project.name.slice(0, 2).toUpperCase()}
                />
              ))
            ) : (
              <EmptyState
                icon={FolderKanban}
                title="No projects"
                description="Create a workspace to get started."
                className="border-none bg-transparent py-8"
              />
            )
          ) : (
            <EmptyState
              icon={FolderKanban}
              title={emptyTitle}
              description={emptyDescription}
              className="border-none bg-transparent py-8"
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
