import { proxyApiRequest } from "@/lib/api-proxy";
import { revalidatePath } from "next/cache";

type RouteContext = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteContext) {
  return proxyApiRequest(`/api/projects/${params.id}`);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const response = await proxyApiRequest(`/api/projects/${params.id}`, {
    method: "DELETE",
  });

  if (response.status === 204) {
    revalidatePath("/dashboard");
    revalidatePath(`/project/${params.id}`, "layout");
  }

  return response;
}
