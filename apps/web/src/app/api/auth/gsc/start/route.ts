import { getApiAuthorizationHeader } from "@/lib/server-auth";
import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("project_id");
  if (!projectId) {
    return NextResponse.json({ detail: "project_id is required" }, { status: 400 });
  }

  const authorization = await getApiAuthorizationHeader();
  if (!authorization) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(
    `${API_BASE}/api/auth/gsc/start?project_id=${encodeURIComponent(projectId)}`,
    {
      headers: { Authorization: authorization },
      redirect: "manual",
      cache: "no-store",
    }
  );

  if (res.status === 302 || res.status === 307) {
    const location = res.headers.get("location");
    if (location) {
      return NextResponse.redirect(location);
    }
  }

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
