import { getApiAuthorizationHeader } from "@/lib/server-auth";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function proxyToApi(path: string, init?: RequestInit) {
  const authorization = await getApiAuthorizationHeader();
  if (!authorization) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      ...init?.headers,
      Authorization: authorization,
    },
  });

  return NextResponse.json(await res.json(), { status: res.status });
}

export async function GET() {
  return proxyToApi("/api/projects");
}

export async function POST(request: Request) {
  const body = await request.json();
  const response = await proxyToApi("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (response.status === 201) {
    revalidatePath("/dashboard");
  }

  return response;
}
