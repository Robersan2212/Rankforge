"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function RouteProgressBar() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    const timer = window.setTimeout(() => setActive(false), 400);
    return () => window.clearTimeout(timer);
  }, [pathname]);

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
          active && "animate-route-progress"
        )}
      />
    </div>
  );
}
