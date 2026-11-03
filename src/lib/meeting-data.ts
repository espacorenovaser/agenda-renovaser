import { randomUUID } from "node:crypto";

export type MeetingActionItem = {
  id: string;
  text: string;
  owner_email: string | null;
  due_date: string | null;
  done: boolean;
};

function validEmail(value: string): boolean {
  return value.length <= 120 && /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(value);
}

export function normalizeMeetingEmails(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 50) return null;
  const emails = [...new Set(value.map((item) => String(item).trim().toLowerCase()))];
  return emails.every(validEmail) ? emails : null;
}

export function normalizeActionItems(value: unknown): MeetingActionItem[] | null {
  if (!Array.isArray(value) || value.length > 50) return null;
  const items: MeetingActionItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw.text !== "string" || raw.text.trim().length > 500) return null;
    const owner = typeof raw.owner_email === "string" && raw.owner_email.trim()
      ? raw.owner_email.trim().toLowerCase()
      : null;
    const dueDate = typeof raw.due_date === "string" && raw.due_date
      ? raw.due_date
      : null;
    if (owner && !validEmail(owner)) return null;
    if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`)))) return null;
    if (raw.text.trim()) {
      items.push({
        id: typeof raw.id === "string" && raw.id.length <= 80 ? raw.id : randomUUID(),
        text: raw.text.trim(),
        owner_email: owner,
        due_date: dueDate,
        done: Boolean(raw.done),
      });
    }
  }
  return items;
}

export function normalizeReminderMinutes(value: unknown): number[] | null {
  if (value === undefined) return [60, 30];
  if (!Array.isArray(value) || value.length > 5) return null;
  const values = value.map(Number);
  if (values.some((minutes) => ![5, 10, 15, 30, 60, 1440].includes(minutes))) return null;
  return [...new Set(values)];
}

export function recurringTimes(
  startAt: string,
  endAt: string,
  frequency: "weekly" | "monthly",
  count: number,
): Array<{ start_at: string; end_at: string }> {
  const start = new Date(startAt);
  const duration = new Date(endAt).getTime() - start.getTime();
  return Array.from({ length: count }, (_, index) => {
    const occurrence = new Date(start);
    if (frequency === "weekly") {
      occurrence.setUTCDate(occurrence.getUTCDate() + index * 7);
    } else if (index > 0) {
      const day = occurrence.getUTCDate();
      occurrence.setUTCDate(1);
      occurrence.setUTCMonth(occurrence.getUTCMonth() + index);
      const lastDay = new Date(Date.UTC(occurrence.getUTCFullYear(), occurrence.getUTCMonth() + 1, 0)).getUTCDate();
      occurrence.setUTCDate(Math.min(day, lastDay));
    }
    return {
      start_at: occurrence.toISOString(),
      end_at: new Date(occurrence.getTime() + duration).toISOString(),
    };
  });
}