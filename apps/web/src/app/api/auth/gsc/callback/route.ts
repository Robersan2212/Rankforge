import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const res = await fetch(`${API_BASE}/api/auth/gsc/callback${url.search}`, {
    redirect: "manual",
    cache: "no-store",
  });

  if (res.status === 302 || res.status === 307) {
    const location = res.headers.get("location");
    if (location) {
      return NextResponse.redirect(location);
    }
  }

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
