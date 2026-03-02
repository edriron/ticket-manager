import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const secret = process.env.KEEP_ALIVE_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "KEEP_ALIVE_SECRET is not configured on the server" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── DB update ─────────────────────────────────────────────────────────────────
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from("keep_alive")
    .update({ last_updated: new Date().toISOString() })
    .eq("id", 1)
    .select("last_updated")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Database update failed", detail: error.message },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      {
        error: "Keep-alive row not found",
        hint: "Run the seed SQL: INSERT INTO keep_alive (id) VALUES (1);",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, updated_at: data.last_updated });
}
