import { proxyApiRequest } from "@/lib/api-proxy";

export async function GET() {
  return proxyApiRequest("/api/projects/stats");
}
