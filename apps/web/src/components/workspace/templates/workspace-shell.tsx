"use client";

import { ReactNode } from "react";
import { RouteProgressBar } from "@/components/workspace/molecules/route-progress-bar";
import { AppSidebar } from "@/components/workspace/organisms/app-sidebar";
import { cn } from "@/lib/utils";

interface WorkspaceShellProps {
  children: ReactNode;
  className?: string;
}

export function WorkspaceShell({ children, className }: WorkspaceShellProps) {
  return (
    <div className="flex min-h-screen gap-2 bg-muted p-2 md:gap-3 md:p-3">
      <div className="hidden md:flex">
        <AppSidebar />
      </div>
      <main
        className={cn(
          "relative flex min-h-[calc(100vh-1rem)] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-card shadow-sm md:min-h-[calc(100vh-1.5rem)]",
          className
        )}
      >
        <RouteProgressBar />
        <header className="flex h-12 shrink-0 items-center border-b border-border px-4 md:hidden">
          <span className="font-mono text-xs tracking-[0.2em]">RANKFORGE</span>
        </header>
        <div className="flex-1 overflow-auto p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
