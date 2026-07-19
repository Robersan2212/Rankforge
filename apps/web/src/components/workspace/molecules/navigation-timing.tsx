"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { shouldEnforceMinPageLoad } from "@/lib/page-loading";

interface NavigationTimingContextValue {
  startedAt: number;
  pathname: string;
  previousPathname: string;
  /** True when this navigation should use the full min-load treatment. */
  enforceMinLoad: boolean;
}

const NavigationTimingContext =
  createContext<NavigationTimingContextValue | null>(null);

export function NavigationTimingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const previousRef = useRef("");

  const value = useMemo(() => {
    const previousPathname = previousRef.current;
    return {
      pathname,
      previousPathname,
      startedAt: Date.now(),
      enforceMinLoad: shouldEnforceMinPageLoad(previousPathname, pathname),
    };
  }, [pathname]);

  useLayoutEffect(() => {
    previousRef.current = pathname;
  }, [pathname]);

  return (
    <NavigationTimingContext.Provider value={value}>
      {children}
    </NavigationTimingContext.Provider>
  );
}

export function useNavigationTiming(): NavigationTimingContextValue {
  const ctx = useContext(NavigationTimingContext);
  if (!ctx) {
    return {
      startedAt: Date.now(),
      pathname: "",
      previousPathname: "",
      enforceMinLoad: false,
    };
  }
  return ctx;
}
