import { getApiAuthorizationHeader } from "@/lib/server-auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function fetchFromApi(path: string, init?: RequestInit) {
  const authorization = await getApiAuthorizationHeader();
  if (!authorization) {
    throw new Error("Unauthorized");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      ...init?.headers,
      Authorization: authorization,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });

  return response;
}
