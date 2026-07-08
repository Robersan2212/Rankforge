import { proxyApiStream } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: { id: string } };

export async function POST(request: Request, { params }: RouteContext) {
  const body = await request.json();
  return proxyApiStream(`/api/projects/${params.id}/drafts/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
