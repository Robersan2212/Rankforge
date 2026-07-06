import { proxyApiRequest } from "@/lib/api-proxy";
import { revalidateProjectWorkspace } from "@/lib/revalidate-workspace";

type RouteContext = { params: { id: string; briefId: string } };

export async function GET(_request: Request, { params }: RouteContext) {
  return proxyApiRequest(
    `/api/projects/${params.id}/briefs/${params.briefId}`
  );
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const response = await proxyApiRequest(
    `/api/projects/${params.id}/briefs/${params.briefId}`,
    { method: "DELETE" }
  );

  if (response.status === 204) {
    revalidateProjectWorkspace(params.id);
  }

  return response;
}
