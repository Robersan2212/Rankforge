import { proxyApiRequest } from "@/lib/api-proxy";
import { revalidateProjectWorkspace } from "@/lib/revalidate-workspace";

type RouteContext = { params: { id: string; keywordId: string } };

export async function POST(_request: Request, { params }: RouteContext) {
  const response = await proxyApiRequest(
    `/api/projects/${params.id}/keywords/${params.keywordId}/refresh`,
    { method: "POST" }
  );

  if (response.ok) {
    revalidateProjectWorkspace(params.id);
  }

  return response;
}
