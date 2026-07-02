import { proxyApiRequest } from "@/lib/api-proxy";
import { revalidateProjectWorkspace } from "@/lib/revalidate-workspace";

type RouteContext = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteContext) {
  return proxyApiRequest(`/api/projects/${params.id}/briefs`);
}

export async function POST(request: Request, { params }: RouteContext) {
  const body = await request.json();
  const response = await proxyApiRequest(`/api/projects/${params.id}/briefs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (response.status === 201) {
    revalidateProjectWorkspace(params.id);
  }

  return response;
}
