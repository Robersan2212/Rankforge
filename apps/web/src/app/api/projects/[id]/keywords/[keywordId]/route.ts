import { proxyApiRequest } from "@/lib/api-proxy";
import { revalidateProjectWorkspace } from "@/lib/revalidate-workspace";

type RouteContext = { params: { id: string; keywordId: string } };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const response = await proxyApiRequest(
    `/api/projects/${params.id}/keywords/${params.keywordId}`,
    { method: "DELETE" }
  );

  if (response.status === 204) {
    revalidateProjectWorkspace(params.id);
  }

  return response;
}
