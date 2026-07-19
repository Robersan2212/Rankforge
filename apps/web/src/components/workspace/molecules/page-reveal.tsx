"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useNavigationTiming } from "@/components/workspace/molecules/navigation-timing";
import { MIN_PAGE_LOAD_MS } from "@/lib/page-loading";
import { cn } from "@/lib/utils";

interface PageRevealProps {
  children: ReactNode;
  /** Skeleton + loading tag shown for hard navigations */
  fallback: ReactNode;
  minMs?: number;
  className?: string;
}

/**
 * Hard navigations (enter project / outside dashboard-home): keep skeleton
 * visible for at least minMs.
 * Soft in-project switches: no forced delay — skeleton still comes from
 * route `loading.tsx` whenever the network is slow.
 */
export function PageReveal({
  children,
  fallback,
  minMs = MIN_PAGE_LOAD_MS,
  className,
}: PageRevealProps) {
  const { startedAt, pathname, enforceMinLoad } = useNavigationTiming();
  const [ready, setReady] = useState(!enforceMinLoad);

  useEffect(() => {
    if (!enforceMinLoad) {
      setReady(true);
      return;
    }

    setReady(false);
    const remaining = Math.max(0, minMs - (Date.now() - startedAt));
    const timer = window.setTimeout(() => setReady(true), remaining);
    return () => window.clearTimeout(timer);
  }, [startedAt, pathname, minMs, enforceMinLoad]);

  if (!ready) {
    return <>{fallback}</>;
  }

  return (
    <div
      className={cn(
        "animate-in fade-in fill-mode-both",
        enforceMinLoad ? "duration-300" : "duration-200",
        className
      )}
    >
      {children}
    </div>
  );
}
