/** Minimum time a hard page load stays visible (ms). Prevents instant flash. */
export const MIN_PAGE_LOAD_MS = 500;

/** Soft in-project section switches use a short fade only. */
export const SOFT_SECTION_TRANSITION_MS = 200;

export const LOADING_LABELS = {
  default: "Loading",
  dashboard: "Loading dashboard",
  project: "Loading project",
  audit: "Loading audit",
  brief: "Loading brief",
  competitor: "Loading analysis",
  editor: "Loading editor",
  section: "Loading section",
} as const;

export type LoadingLabelKey = keyof typeof LOADING_LABELS;

const PROJECT_PATH_RE =
  /^\/project\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/([^/?#]+))?/i;

export function parseProjectPath(pathname: string): {
  projectId: string;
  section: string | null;
} | null {
  const match = pathname.match(PROJECT_PATH_RE);
  if (!match) return null;
  return {
    projectId: match[1],
    section: match[2] ?? null,
  };
}

export function isDashboardOrHome(pathname: string): boolean {
  return pathname === "/" || pathname === "/dashboard";
}

export function isProjectPath(pathname: string): boolean {
  return parseProjectPath(pathname) !== null;
}

/**
 * Navigating between areas inside the same project (sidebar sections,
 * list → detail, detail → list). These should feel instant + smooth.
 */
export function isSoftProjectNavigation(from: string, to: string): boolean {
  const a = parseProjectPath(from);
  const b = parseProjectPath(to);
  if (!a || !b) return false;
  return a.projectId === b.projectId;
}

/**
 * Enforce the standard min-load skeleton+tag when:
 * - Entering a project from outside that project
 * - Opening pages outside dashboard / home (that aren't soft in-project nav)
 *
 * Skip for dashboard/home and same-project sidebar/section switches.
 */
export function shouldEnforceMinPageLoad(from: string, to: string): boolean {
  if (!to) return false;
  if (isSoftProjectNavigation(from, to)) return false;
  if (isDashboardOrHome(to)) return false;
  if (isProjectPath(to)) return true;
  return !isDashboardOrHome(to);
}
