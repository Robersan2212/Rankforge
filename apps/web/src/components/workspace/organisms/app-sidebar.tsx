"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/workspace/atoms/brand-mark";
import { useWorkspace } from "@/contexts/workspace-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_NAV,
  PROJECT_SECTIONS,
  SECTION_CONFIG,
  isProjectSection,
} from "@/lib/workspace";

function getUserInitials(email: string) {
  const local = email.split("@")[0] ?? "U";
  return local.slice(0, 2).toUpperCase();
}

function parseProjectPath(pathname: string) {
  const match = pathname.match(/^\/project\/([^/]+)(?:\/([^/]+))?/);
  if (!match) return null;
  const projectId = match[1];
  const section = match[2];
  return {
    projectId,
    section: section && isProjectSection(section) ? section : null,
    basePath: `/project/${projectId}`,
  };
}

function NavLink({
  href,
  icon: Icon,
  label,
  active = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { userEmail } = useWorkspace();

  const isDashboard = pathname === "/dashboard";
  const projectPath = parseProjectPath(pathname);

  return (
    <aside className="flex w-64 shrink-0 flex-col rounded-2xl bg-sidebar text-sidebar-foreground">
      <div className="p-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-sidebar-accent"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent">
            <span className="text-sm font-bold">R</span>
          </div>
          <BrandMark className="text-sidebar-foreground" />
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        <NavLink
          href={DASHBOARD_NAV.href}
          icon={DASHBOARD_NAV.icon}
          label={DASHBOARD_NAV.label}
          active={isDashboard}
        />

        {projectPath && (
          <>
            <Separator className="my-2 bg-sidebar-border" />
            <NavLink
              href="/dashboard"
              icon={ArrowLeft}
              label="Back to dashboard"
            />
            {PROJECT_SECTIONS.map((key) => {
              const config = SECTION_CONFIG[key];
              return (
                <NavLink
                  key={key}
                  href={`${projectPath.basePath}/${key}`}
                  icon={config.icon}
                  label={config.label}
                  active={projectPath.section === key}
                />
              );
            })}
          </>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar className="size-9 shrink-0">
            <AvatarFallback className="bg-sidebar-accent text-xs text-sidebar-foreground">
              {getUserInitials(userEmail)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{userEmail}</p>
            <p className="truncate text-xs text-sidebar-foreground/70">
              Workspace
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
