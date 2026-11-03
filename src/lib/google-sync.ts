import { google } from "googleapis";
import { randomUUID } from "node:crypto";
import { createOAuth2Client } from "@/lib/google";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export type GoogleEventInput = {
  summary: string;
  description: string;
  start_at: string; // ISO
  end_at: string;
  attendees: string[];
  reminderMinutes?: number[];
  onlineMeeting?: boolean;
};

export type GoogleEventResult = {
  id: string | null;
  link: string | null;
  meetingLink: string | null;
};

async function getCalendar() {
  const supabase = getSupabaseAdmin();
  const { data: users } = await supabase
    .from("users")
    .select("google_refresh_token, google_access_token, email")
    .not("google_refresh_token", "is", null)
    .limit(1);

  const user = users?.[0];
  if (!user?.google_refresh_token) return null;

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: user.google_access_token,
    refresh_token: user.google_refresh_token,
  });

  await oauth2Client.getAccessToken();
  return google.calendar({ version: "v3", auth: oauth2Client });
}

function reminderOverrides(minutes: number[] | undefined) {
  return (minutes ?? [60, 30]).map((value) => ({ method: "popup" as const, minutes: value }));
}

function eventBody(opts: GoogleEventInput) {
  return {
    summary: opts.summary,
    description: opts.description,
    start: { dateTime: opts.start_at, timeZone: "America/Sao_Paulo" },
    end: { dateTime: opts.end_at, timeZone: "America/Sao_Paulo" },
    attendees: opts.attendees.map((email) => ({ email })),
    reminders: { useDefault: false, overrides: reminderOverrides(opts.reminderMinutes) },
    ...(opts.onlineMeeting ? {
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    } : {}),
  };
}

function eventResult(event: { id?: string | null; htmlLink?: string | null; hangoutLink?: string | null }): GoogleEventResult {
  return {
    id: event.id ?? null,
    link: event.htmlLink ?? null,
    meetingLink: event.hangoutLink ?? null,
  };
}

export async function syncToGoogleCalendar(opts: GoogleEventInput): Promise<GoogleEventResult | null> {
  const calendar = await getCalendar();
  if (!calendar) return null;

  const res = await calendar.events.insert({
    calendarId: "primary",
    sendUpdates: "all",
    ...(opts.onlineMeeting ? { conferenceDataVersion: 1 } : {}),
    requestBody: eventBody(opts),
  });

  return eventResult(res.data);
}

export async function updateGoogleCalendarEvent(eventId: string, opts: GoogleEventInput): Promise<GoogleEventResult | null> {
  const calendar = await getCalendar();
  if (!calendar) return null;
  const res = await calendar.events.patch({
    calendarId: "primary",
    eventId,
    sendUpdates: "all",
    ...(opts.onlineMeeting ? { conferenceDataVersion: 1 } : {}),
    requestBody: eventBody(opts),
  });
  return eventResult(res.data);
}

export async function deleteGoogleCalendarEvent(eventId: string): Promise<void> {
  const calendar = await getCalendar();
  if (!calendar) return;
  try {
    await calendar.events.delete({ calendarId: "primary", eventId, sendUpdates: "all" });
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error ? Number(error.code) : undefined;
    if (code !== 404) throw error;
  }
}

export async function getGoogleEventGuests(eventId: string) {
  const calendar = await getCalendar();
  if (!calendar) return [];
  const { data } = await calendar.events.get({ calendarId: "primary", eventId });
  return (data.attendees ?? []).map((attendee) => ({
    email: attendee.email ?? "",
    name: attendee.displayName ?? null,
    response: attendee.responseStatus ?? "needsAction",
  }));
}
