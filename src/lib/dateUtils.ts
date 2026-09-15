/**
 * Date and Timezone Utilities for America/Sao_Paulo (GMT-3)
 */

export const SAO_PAULO_TZ = 'America/Sao_Paulo';

// Formats an ISO string or Date into friendly Brazilian Portuguese representation
export function formatDateTimeBR(isoString: string | undefined): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: SAO_PAULO_TZ,
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return isoString;
  }
}

export function formatTimeBR(isoString: string | undefined): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: SAO_PAULO_TZ,
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return isoString;
  }
}

export function formatDateOnlyBR(isoString: string | undefined): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: SAO_PAULO_TZ,
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return isoString;
  }
}

// Get current ISO string in America/Sao_Paulo offset
export function getCurrentSaoPauloIso(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hour = getPart('hour');
  const minute = getPart('minute');
  const second = getPart('second');

  return `${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`;
}

// Get start and end of day in Sao Paulo
export function getDayBoundariesIso(targetDate: Date = new Date()): { timeMin: string; timeMax: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(targetDate);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  return {
    timeMin: `${year}-${month}-${day}T00:00:00-03:00`,
    timeMax: `${year}-${month}-${day}T23:59:59-03:00`,
  };
}

// Detect if two intervals overlap
export function intervalsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const aStart = new Date(startA).getTime();
  const aEnd = new Date(endA).getTime();
  const bStart = new Date(startB).getTime();
  const bEnd = new Date(endB).getTime();

  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

export function formatDayHeaderBR(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: SAO_PAULO_TZ,
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function getMonthYearBR(date: Date): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: SAO_PAULO_TZ,
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return '';
  }
}
