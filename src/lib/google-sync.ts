import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { oauth2Client } from "@/lib/google";

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export async function syncToGoogleCalendar(opts: {
  summary: string;
  description: string;
  start_at: string; // ISO
  end_at: string;
  attendees: string[];
}): Promise<string | null> {
  // tenta pegar token do primeiro admin que tem refresh_token — em produção, ideal é usar o token do profissional
  const supabase = getSupabase();
  const { data: users } = await supabase
    .from("users")
    .select("google_refresh_token, google_access_token, email")
    .not("google_refresh_token", "is", null)
    .limit(1);

  const user = users?.[0];
  if (!user?.google_refresh_token) return null;

  oauth2Client.setCredentials({
    access_token: user.google_access_token,
    refresh_token: user.google_refresh_token,
  });

  // refresh se necessário
  try {
    await oauth2Client.getAccessToken();
  } catch {}

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const res = await calendar.events.insert({
    calendarId: "primary",
    sendUpdates: "all",
    requestBody: {
      summary: opts.summary,
      description: opts.description,
      start: { dateTime: opts.start_at, timeZone: "America/Sao_Paulo" },
      end: { dateTime: opts.end_at, timeZone: "America/Sao_Paulo" },
      attendees: opts.attendees.map((email) => ({ email })),
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 60 },
          { method: "popup", minutes: 30 },
        ],
      },
    },
  });

  return res.data.id ?? null;
}
