import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { ROOMS } from "@/lib/rooms";

type AppointmentConflict = {
  start_at: string;
  end_at: string;
  room_id: string | null;
  modality: string;
  professional_email: string | null;
  participants: string[] | null;
  event_professionals: string[] | null;
};

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date") ?? "";
  const duration = Number(req.nextUrl.searchParams.get("duration") ?? 60);
  const modality = req.nextUrl.searchParams.get("modality") ?? "presencial";
  const roomId = req.nextUrl.searchParams.get("room_id") ?? "";
  const participants = new Set(req.nextUrl.searchParams.getAll("participant").map((email) => email.toLowerCase()));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) {
    return NextResponse.json({ error: "Data inválida." }, { status: 400 });
  }
  if (!Number.isInteger(duration) || duration < 15 || duration > 240) {
    return NextResponse.json({ error: "Duração deve ser de 15 a 240 minutos." }, { status: 400 });
  }
  if (!["presencial", "online"].includes(modality) || (modality === "presencial" && !ROOMS.some((room) => room.id === roomId))) {
    return NextResponse.json({ error: "Modalidade ou sala inválida." }, { status: 400 });
  }

  const dayStart = new Date(`${date}T00:00:00-03:00`);
  const dayEnd = new Date(`${date}T23:59:59-03:00`);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .select("start_at,end_at,room_id,modality,professional_email,participants,event_professionals")
    .lt("start_at", dayEnd.toISOString())
    .gt("end_at", dayStart.toISOString());
  if (error) return NextResponse.json({ error: "Não foi possível consultar a disponibilidade." }, { status: 500 });

  const suggestions: Array<{ start_at: string; end_at: string; time: string }> = [];
  for (let minute = 8 * 60; minute + duration <= 18 * 60 && suggestions.length < 5; minute += 30) {
    const start = new Date(`${date}T${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}:00-03:00`);
    const end = new Date(start.getTime() + duration * 60_000);
    const conflict = ((data ?? []) as AppointmentConflict[]).some((appointment) => {
      const overlap = new Date(appointment.start_at) < end && new Date(appointment.end_at) > start;
      if (!overlap) return false;
      const owner = String(appointment.professional_email ?? "").toLowerCase();
      const attendeeConflict = participants.has(owner) ||
        (appointment.participants ?? []).some((email: string) => participants.has(String(email).toLowerCase())) ||
        (appointment.event_professionals ?? []).some((email: string) => participants.has(String(email).toLowerCase()));
      const roomConflict = modality === "presencial" && appointment.modality === "presencial" &&
        (roomId === "auditorio" || appointment.room_id === "auditorio" || appointment.room_id === roomId);
      return attendeeConflict || roomConflict;
    });
    if (!conflict) {
      suggestions.push({
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        time: `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`,
      });
    }
  }

  return NextResponse.json({ suggestions });
}