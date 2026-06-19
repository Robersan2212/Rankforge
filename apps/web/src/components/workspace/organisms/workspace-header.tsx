import { ReactNode } from "react";
import { PageTitle } from "@/components/workspace/atoms/page-title";
import { cn } from "@/lib/utils";

interface WorkspaceHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function WorkspaceHeader({
  title,
  subtitle,
  actions,
  className,
}: WorkspaceHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <PageTitle title={title} subtitle={subtitle} />
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
      )}
    </header>
  );
}
