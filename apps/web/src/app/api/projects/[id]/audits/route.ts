import { proxyApiRequest } from "@/lib/api-proxy";

type RouteContext = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteContext) {
  return proxyApiRequest(`/api/projects/${params.id}/audits`);
}

export async function POST(request: Request, { params }: RouteContext) {
  const body = await request.json();
  return proxyApiRequest(`/api/projects/${params.id}/audits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
