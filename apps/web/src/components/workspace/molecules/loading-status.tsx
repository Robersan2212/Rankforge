import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStatusProps {
  label?: string;
  className?: string;
}

/**
 * Standard loading tag used on every page loading screen.
 * Pairs with skeleton placeholders (does not replace them).
 */
export function LoadingStatus({
  label = "Loading",
  className,
}: LoadingStatusProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground",
        className
      )}
    >
      <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
      <span>{label}</span>
      <span className="sr-only">Please wait</span>
    </div>
  );
}
