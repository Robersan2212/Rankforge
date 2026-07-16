import { proxyApiRequest } from "@/lib/api-proxy";
import { revalidateProjectWorkspace } from "@/lib/revalidate-workspace";

export async function POST(request: Request) {
  const body = await request.json();
  const response = await proxyApiRequest("/api/auth/gsc/disconnect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (response.ok && body?.project_id) {
    revalidateProjectWorkspace(body.project_id);
  }

  return response;
}
