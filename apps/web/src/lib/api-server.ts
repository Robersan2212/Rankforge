import { cache } from "react";
import { getApiAuthorizationHeader } from "@/lib/server-auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchFromApiImpl(path: string, init?: RequestInit) {
  const authorization = await getApiAuthorizationHeader();
  if (!authorization) {
    throw new Error("Unauthorized");
  }

  return fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      ...init?.headers,
      Authorization: authorization,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

const fetchGetCached = cache((path: string) => fetchFromApiImpl(path));

export async function fetchFromApi(path: string, init?: RequestInit) {
  const method = init?.method?.toUpperCase() ?? "GET";
  if (method === "GET" && !init?.body) {
    return fetchGetCached(path);
  }
  return fetchFromApiImpl(path, init);
}

export const fetchProject = cache(async (projectId: string) => {
  return fetchFromApi(`/api/projects/${projectId}`);
});
