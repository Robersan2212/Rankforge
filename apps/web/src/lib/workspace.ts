import type { LucideIcon } from "lucide-react";
import {
  BarChart2,
  FileText,
  LayoutDashboard,
  PenLine,
  Search,
  Tags,
} from "lucide-react";

export const PROJECT_SECTIONS = [
  "audits",
  "competitors",
  "briefs",
  "editor",
  "keywords",
] as const;

export type ProjectSection = (typeof PROJECT_SECTIONS)[number];

export function isProjectSection(value: string): value is ProjectSection {
  return PROJECT_SECTIONS.includes(value as ProjectSection);
}

export const SECTION_API_PATH: Record<ProjectSection, string> = {
  audits: "audits",
  competitors: "competitor-analyses",
  briefs: "briefs",
  editor: "drafts",
  keywords: "keywords",
};

export const SECTION_CONFIG: Record<
  ProjectSection,
  { label: string; icon: LucideIcon; description: string; singular: string }
> = {
  audits: {
    label: "Audits",
    icon: Search,
    singular: "audit",
    description: "Save page audits scoped to this project.",
  },
  competitors: {
    label: "Competitors",
    icon: BarChart2,
    singular: "analysis",
    description: "SERP competitor analysis and content gap insights.",
  },
  briefs: {
    label: "Briefs",
    icon: FileText,
    singular: "brief",
    description: "Content briefs stored per project.",
  },
  editor: {
    label: "Editor",
    icon: PenLine,
    singular: "draft",
    description: "Content drafts stored per project.",
  },
  keywords: {
    label: "Keywords",
    icon: Tags,
    singular: "keyword",
    description: "Tracked keywords stored per project.",
  },
};

export const DASHBOARD_NAV = {
  label: "Dashboard",
  icon: LayoutDashboard,
  href: "/dashboard",
} as const;
