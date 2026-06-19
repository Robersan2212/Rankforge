import type { LucideIcon } from "lucide-react";
import {
  FileText,
  LayoutDashboard,
  PenLine,
  Search,
  Tags,
} from "lucide-react";

export const PROJECT_SECTIONS = [
  "audits",
  "briefs",
  "editor",
  "keywords",
] as const;

export type ProjectSection = (typeof PROJECT_SECTIONS)[number];

export function isProjectSection(value: string): value is ProjectSection {
  return PROJECT_SECTIONS.includes(value as ProjectSection);
}

export const SECTION_CONFIG: Record<
  ProjectSection,
  { label: string; icon: LucideIcon; description: string }
> = {
  audits: {
    label: "Audits",
    icon: Search,
    description: "Run your first page audit (FR-02).",
  },
  briefs: {
    label: "Briefs",
    icon: FileText,
    description: "Content briefs — coming in a later phase.",
  },
  editor: {
    label: "Editor",
    icon: PenLine,
    description: "Draft editor — coming in a later phase.",
  },
  keywords: {
    label: "Keywords",
    icon: Tags,
    description: "Tracked keywords — coming in a later phase.",
  },
};

export const DASHBOARD_NAV = {
  label: "Dashboard",
  icon: LayoutDashboard,
  href: "/dashboard",
} as const;
