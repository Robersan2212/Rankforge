import { proxyApiRequest } from "@/lib/api-proxy";

export async function POST(request: Request) {
  const body = await request.json();
  return proxyApiRequest("/api/auth/gsc/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
