"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useNavigationTiming } from "@/components/workspace/molecules/navigation-timing";
import { MIN_PAGE_LOAD_MS, SOFT_SECTION_TRANSITION_MS } from "@/lib/page-loading";
import { cn } from "@/lib/utils";

export function RouteProgressBar() {
  const pathname = usePathname();
  const { enforceMinLoad } = useNavigationTiming();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    const duration = enforceMinLoad
      ? MIN_PAGE_LOAD_MS
      : SOFT_SECTION_TRANSITION_MS;
    const timer = window.setTimeout(() => setActive(false), duration);
    return () => window.clearTimeout(timer);
  }, [pathname, enforceMinLoad]);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 z-50 h-0.5 overflow-hidden",
        active ? "opacity-100" : "opacity-0",
        "transition-opacity duration-200"
      )}
    >
      <div
        className={cn(
          "h-full w-1/3 bg-primary",
          active &&
            (enforceMinLoad
              ? "animate-route-progress"
              : "animate-route-progress-soft")
        )}
      />
    </div>
  );
}
