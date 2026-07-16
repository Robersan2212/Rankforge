import { proxyApiRequest } from "@/lib/api-proxy";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("project_id");
  if (!projectId) {
    return proxyApiRequest("/api/auth/gsc/status?project_id=");
  }
  return proxyApiRequest(
    `/api/auth/gsc/status?project_id=${encodeURIComponent(projectId)}`
  );
}
