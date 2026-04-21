/**
 * Google Calendar REST client — create/update/delete events for routine blocks.
 * Uses the primary calendar. Native popup reminders piggyback on Google's own
 * event reminder system, so the user's phone gets notifications without us
 * wiring expo-notifications.
 */

import { getCalendarAccessToken } from './oauth';

const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

interface TimeBlockEvent {
  title: string;
  description?: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM (24h, local) */
  startTime: string;
  /** HH:MM (24h, local) */
  endTime: string;
  /** Minutes before start to trigger a popup reminder. Default 10. */
  reminderMinutes?: number;
}

function resolveTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function toRfc3339(date: string, time: string): string {
  // Google accepts `YYYY-MM-DDTHH:MM:SS` with a separate `timeZone` field.
  return `${date}T${time.length === 5 ? `${time}:00` : time}`;
}

function buildBody(block: TimeBlockEvent) {
  const tz = resolveTimeZone();
  const reminderMinutes = block.reminderMinutes ?? 10;
  return {
    summary: block.title,
    description: block.description ?? 'Scheduled by LifeOS',
    start: { dateTime: toRfc3339(block.date, block.startTime), timeZone: tz },
    end: { dateTime: toRfc3339(block.date, block.endTime), timeZone: tz },
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: reminderMinutes }],
    },
    source: { title: 'LifeOS', url: 'https://lifeos.app' },
  };
}

async function authedFetch(
  clientId: string,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getCalendarAccessToken(clientId);
  if (!token) throw new Error('Google Calendar is not connected');
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

export async function createCalendarEvent(
  clientId: string,
  block: TimeBlockEvent,
): Promise<string> {
  const res = await authedFetch(clientId, BASE, {
    method: 'POST',
    body: JSON.stringify(buildBody(block)),
  });
  if (!res.ok) throw new Error(`Create event failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.id as string;
}

export async function updateCalendarEvent(
  clientId: string,
  eventId: string,
  block: TimeBlockEvent,
): Promise<void> {
  const res = await authedFetch(clientId, `${BASE}/${encodeURIComponent(eventId)}`, {
    method: 'PUT',
    body: JSON.stringify(buildBody(block)),
  });
  if (!res.ok) throw new Error(`Update event failed: ${res.status} ${await res.text()}`);
}

export async function deleteCalendarEvent(
  clientId: string,
  eventId: string,
): Promise<void> {
  const res = await authedFetch(clientId, `${BASE}/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
  });
  // 404/410 means the event is already gone — treat as success.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Delete event failed: ${res.status} ${await res.text()}`);
  }
}

export interface RoutineBlockForCalendar {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  module?: string;
  notes?: string;
  calendarEventId?: string;
}

export interface SyncResult {
  created: number;
  updated: number;
  failed: number;
  /** Map of routine block id → Google event id. Caller persists these. */
  eventIds: Record<string, string>;
  errors: string[];
}

/**
 * Push a set of routine blocks to Google Calendar. Blocks that already carry
 * a `calendarEventId` are updated in place; the rest are created.
 */
export async function syncBlocksToCalendar(
  clientId: string,
  blocks: RoutineBlockForCalendar[],
  reminderMinutes = 10,
): Promise<SyncResult> {
  const out: SyncResult = { created: 0, updated: 0, failed: 0, eventIds: {}, errors: [] };
  for (const b of blocks) {
    const payload: TimeBlockEvent = {
      title: b.title,
      description: b.notes || (b.module ? `${b.module} — LifeOS routine` : 'LifeOS routine'),
      date: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      reminderMinutes,
    };
    try {
      if (b.calendarEventId) {
        await updateCalendarEvent(clientId, b.calendarEventId, payload);
        out.updated += 1;
        out.eventIds[b.id] = b.calendarEventId;
      } else {
        const eventId = await createCalendarEvent(clientId, payload);
        out.created += 1;
        out.eventIds[b.id] = eventId;
      }
    } catch (err) {
      out.failed += 1;
      out.errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  return out;
}
