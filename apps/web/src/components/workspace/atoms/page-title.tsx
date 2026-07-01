import { cn } from "@/lib/utils";

interface PageTitleProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function PageTitle({ title, subtitle, className }: PageTitleProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle && (
        <p className="mt-1 truncate text-sm text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}
