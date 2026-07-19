import { PageLoading } from "@/components/workspace/molecules/page-loading";
import { DashboardSkeleton } from "@/components/workspace/molecules/page-skeletons";
import { LOADING_LABELS } from "@/lib/page-loading";

export default function WorkspaceLoading() {
  return (
    <PageLoading label={LOADING_LABELS.dashboard}>
      <DashboardSkeleton />
    </PageLoading>
  );
}
