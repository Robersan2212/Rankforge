import { getApiAuthorizationHeader } from "@/lib/server-auth";
import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const authorization = await getApiAuthorizationHeader();
  if (!authorization) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(`${API_BASE}/api/projects/${params.id}`, {
    headers: { Authorization: authorization },
  });

  return NextResponse.json(await res.json(), { status: res.status });
}
