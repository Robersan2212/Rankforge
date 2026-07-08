import { getApiAuthorizationHeader } from "@/lib/server-auth";
import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function proxyApiStream(path: string, init?: RequestInit) {
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

  if (!res.ok && !res.body) {
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  }

  const headers = new Headers();
  const contentType = res.headers.get("Content-Type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  headers.set("Cache-Control", "no-cache");

  return new Response(res.body, {
    status: res.status,
    headers,
  });
}

export async function proxyApiRequest(path: string, init?: RequestInit) {
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

  if (res.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
