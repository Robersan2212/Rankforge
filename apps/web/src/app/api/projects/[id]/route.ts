import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(`${API_BASE}/api/projects/${params.id}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  return NextResponse.json(await res.json(), { status: res.status });
}
