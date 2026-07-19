import { PageLoading } from "@/components/workspace/molecules/page-loading";
import { ProjectPageSkeleton } from "@/components/workspace/molecules/page-skeletons";
import { LOADING_LABELS } from "@/lib/page-loading";

/** Skeleton is always shown while the route is pending (including slow networks). */
export default function ProjectSectionLoading() {
  return (
    <PageLoading label={LOADING_LABELS.section}>
      <ProjectPageSkeleton />
    </PageLoading>
  );
}
