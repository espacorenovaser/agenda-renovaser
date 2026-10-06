import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

// GET /api/availability?start=...&end=...
export async function GET(req: NextRequest) {
  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  if (!start || !end) return NextResponse.json({ error: "Informe start e end" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .select("id,title,room_id,modality,start_at,end_at")
    .eq("modality", "presencial")
    .lt("start_at", end)
    .gt("end_at", start);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const blocked = new Set<string>();
  for (const a of data ?? []) if (a.room_id) blocked.add(a.room_id);

  return NextResponse.json({
    conflicts: data,
    blockedRooms: [...blocked],
    auditorioBlocked: (data ?? []).length > 0,
  });
}
