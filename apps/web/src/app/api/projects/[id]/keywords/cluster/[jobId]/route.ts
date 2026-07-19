import { proxyApiRequest } from "@/lib/api-proxy";

type RouteContext = { params: { id: string; jobId: string } };

export async function GET(_request: Request, { params }: RouteContext) {
  return proxyApiRequest(
    `/api/projects/${params.id}/keywords/cluster/${params.jobId}`
  );
}
