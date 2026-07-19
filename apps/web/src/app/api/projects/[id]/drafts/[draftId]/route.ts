import { proxyApiRequest } from "@/lib/api-proxy";
import { revalidateProjectWorkspace } from "@/lib/revalidate-workspace";

type RouteContext = { params: { id: string; draftId: string } };

export async function GET(_request: Request, { params }: RouteContext) {
  return proxyApiRequest(
    `/api/projects/${params.id}/drafts/${params.draftId}`
  );
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const body = await request.json();
  const response = await proxyApiRequest(
    `/api/projects/${params.id}/drafts/${params.draftId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (response.ok) {
    revalidateProjectWorkspace(params.id);
  }

  return response;
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const response = await proxyApiRequest(
    `/api/projects/${params.id}/drafts/${params.draftId}`,
    { method: "DELETE" }
  );

  if (response.status === 204) {
    revalidateProjectWorkspace(params.id);
  }

  return response;
}
