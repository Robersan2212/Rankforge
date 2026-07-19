import { PageLoading } from "@/components/workspace/molecules/page-loading";
import { ProjectPageSkeleton } from "@/components/workspace/molecules/page-skeletons";
import { LOADING_LABELS } from "@/lib/page-loading";

export default function ProjectLoading() {
  return (
    <PageLoading label={LOADING_LABELS.project}>
      <ProjectPageSkeleton />
    </PageLoading>
  );
}
