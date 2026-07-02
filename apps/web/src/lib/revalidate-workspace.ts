import { revalidatePath } from "next/cache";

export function revalidateProjectWorkspace(projectId: string) {
  revalidatePath("/dashboard");
  revalidatePath(`/project/${projectId}/audits`);
  revalidatePath(`/project/${projectId}/briefs`);
  revalidatePath(`/project/${projectId}/editor`);
  revalidatePath(`/project/${projectId}/keywords`);
}
