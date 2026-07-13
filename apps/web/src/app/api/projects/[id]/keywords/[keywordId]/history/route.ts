import { proxyApiRequest } from "@/lib/api-proxy";

type RouteContext = { params: { id: string; keywordId: string } };

export async function GET(_request: Request, { params }: RouteContext) {
  return proxyApiRequest(
    `/api/projects/${params.id}/keywords/${params.keywordId}/history`
  );
}
