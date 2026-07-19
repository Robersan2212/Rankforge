import type { ReactNode } from "react";
import { LoadingStatus } from "@/components/workspace/molecules/loading-status";
import { cn } from "@/lib/utils";

interface PageLoadingProps {
  /** Visible loading tag text */
  label?: string;
  /** Skeleton layout to preserve under the loading tag */
  children: ReactNode;
  className?: string;
}

/**
 * Standard page loading screen: status tag + skeleton.
 * Use from route `loading.tsx` and as PageReveal fallback.
 */
export function PageLoading({
  label = "Loading",
  children,
  className,
}: PageLoadingProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn("space-y-6 animate-in fade-in duration-300", className)}
    >
      <LoadingStatus label={label} />
      <div aria-hidden>{children}</div>
    </div>
  );
}
