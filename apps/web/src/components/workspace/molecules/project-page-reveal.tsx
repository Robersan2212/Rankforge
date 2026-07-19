"use client";

import type { ReactNode } from "react";
import { PageLoading } from "@/components/workspace/molecules/page-loading";
import { PageReveal } from "@/components/workspace/molecules/page-reveal";
import {
  AuditDetailSkeleton,
  BriefDetailSkeleton,
  CompetitorDetailSkeleton,
  EditorDetailSkeleton,
  ProjectPageSkeleton,
} from "@/components/workspace/molecules/page-skeletons";
import { LOADING_LABELS } from "@/lib/page-loading";

export type ProjectRevealKind =
  | "section"
  | "audit"
  | "brief"
  | "competitor"
  | "editor";

const FALLBACKS: Record<ProjectRevealKind, ReactNode> = {
  section: (
    <PageLoading label={LOADING_LABELS.section}>
      <ProjectPageSkeleton />
    </PageLoading>
  ),
  audit: (
    <PageLoading label={LOADING_LABELS.audit}>
      <AuditDetailSkeleton />
    </PageLoading>
  ),
  brief: (
    <PageLoading label={LOADING_LABELS.brief}>
      <BriefDetailSkeleton />
    </PageLoading>
  ),
  competitor: (
    <PageLoading label={LOADING_LABELS.competitor}>
      <CompetitorDetailSkeleton />
    </PageLoading>
  ),
  editor: (
    <PageLoading label={LOADING_LABELS.editor}>
      <EditorDetailSkeleton />
    </PageLoading>
  ),
};

interface ProjectPageRevealProps {
  kind: ProjectRevealKind;
  children: ReactNode;
}

/** Reveals content with skeleton fallback; min-load delay only on hard navigations. */
export function ProjectPageReveal({ kind, children }: ProjectPageRevealProps) {
  return <PageReveal fallback={FALLBACKS[kind]}>{children}</PageReveal>;
}
