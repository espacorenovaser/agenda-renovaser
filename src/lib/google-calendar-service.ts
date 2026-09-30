/**
 * Google Calendar API Service (Supabase Migration Stubs)
 *
 * These functions are stubs for the Firebase→Supabase migration.
 * The application now uses Supabase for event storage instead of Google Calendar.
 * TODO: Decide whether to implement Google Calendar sync or deprecate completely
 */

import type { Evento } from '../types';

/**
 * Fetch events from Google Calendar API
 * Currently a stub - returns empty array
 * @param accessToken - Google OAuth access token
 * @returns Promise resolving to empty event array
 */
export async function fetchGoogleCalendarEvents(
  accessToken: string
): Promise<Evento[]> {
  console.warn('Google Calendar sync not yet implemented for Supabase. Using local events only.');
  return [];
}

/**
 * Create an event in Google Calendar
 * Currently a stub - returns null
 * @param accessToken - Google OAuth access token
 * @param event - Event details
 * @returns Promise resolving to null
 */
export async function createGoogleCalendarEvent(
  accessToken: string,
  event: Evento
): Promise<any> {
  console.warn('Google Calendar event creation not implemented. Event saved to Supabase only.');
  return null;
}

/**
 * Delete an event from Google Calendar
 * Currently a stub - returns null
 * @param accessToken - Google OAuth access token
 * @param eventId - Google Calendar event ID
 * @returns Promise resolving to null
 */
export async function deleteGoogleCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<any> {
  console.warn('Google Calendar event deletion not implemented.');
  return null;
}