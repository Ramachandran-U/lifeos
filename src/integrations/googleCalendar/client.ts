/**
 * Google Calendar REST client — create/update/delete events for routine blocks,
 * and read back the user's real commitments so the planner can schedule around
 * them. Uses the primary calendar. Native popup reminders piggyback on Google's
 * own event reminder system, so the user's phone gets notifications without us
 * wiring expo-notifications.
 *
 * The read path (`listCalendarEvents`) reuses the same `calendar.events` scope
 * the write path already holds — no new permission or consent.
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

// ── Read path ──────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  /** Event title (Google `summary`), or 'Busy' when the summary is hidden. */
  title: string;
  /** YYYY-MM-DD (local date the event starts). */
  date: string;
  /** HH:MM (24h, local) — null for all-day events. */
  startTime: string | null;
  /** HH:MM (24h, local) — null for all-day events. */
  endTime: string | null;
  allDay: boolean;
  /** ms since epoch (local start-of-day for all-day events). */
  startMs: number;
  endMs: number;
  /** the invitee's own RSVP: accepted | declined | tentative | needsAction | null. */
  responseStatus: string | null;
  /** true if this is an instance of a recurring event. */
  recurring: boolean;
  location?: string;
}

type GoogleEventDateTime = { dateTime?: string; date?: string; timeZone?: string };
type GoogleEvent = {
  id?: string;
  summary?: string;
  status?: string;
  start?: GoogleEventDateTime;
  end?: GoogleEventDateTime;
  recurringEventId?: string;
  location?: string;
  attendees?: Array<{ self?: boolean; responseStatus?: string }>;
};

function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function localDateKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfLocalDayMs(ref: number): number {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function parseEvent(raw: GoogleEvent): CalendarEvent | null {
  if (raw.status === 'cancelled') return null; // cancelled instances never block time
  const id = raw.id;
  if (!id) return null;

  const allDay = !!raw.start?.date && !raw.start?.dateTime;
  let startMs: number;
  let endMs: number;
  if (allDay) {
    // All-day `date` is a calendar day with no zone; anchor to local midnight.
    startMs = startOfLocalDayMs(new Date(`${raw.start!.date}T00:00:00`).getTime());
    endMs = raw.end?.date
      ? startOfLocalDayMs(new Date(`${raw.end.date}T00:00:00`).getTime())
      : startMs + 24 * 60 * 60 * 1000;
  } else {
    startMs = new Date(raw.start?.dateTime ?? '').getTime();
    endMs = new Date(raw.end?.dateTime ?? raw.start?.dateTime ?? '').getTime();
  }
  if (!Number.isFinite(startMs)) return null;
  if (!Number.isFinite(endMs) || endMs < startMs) endMs = startMs;

  const self = raw.attendees?.find((a) => a.self);
  return {
    id,
    title: (raw.summary ?? '').trim() || 'Busy',
    date: localDateKey(startMs),
    startTime: allDay ? null : hhmm(startMs),
    endTime: allDay ? null : hhmm(endMs),
    allDay,
    startMs,
    endMs,
    responseStatus: self?.responseStatus ?? null,
    recurring: !!raw.recurringEventId,
    location: raw.location,
  };
}

export interface ListEventsOptions {
  /** Window start (ms). Defaults to the start of the local day. */
  startMs?: number;
  /** Window end (ms). Defaults to the end of the local day. */
  endMs?: number;
  maxResults?: number;
}

/**
 * Read the user's primary-calendar events in a time window (default: today).
 * Recurring events are expanded to their instances; cancelled instances and
 * events the user has declined are dropped — neither blocks time on the plan.
 * Results are sorted by start time.
 */
export async function listCalendarEvents(
  clientId: string,
  opts: ListEventsOptions = {},
): Promise<CalendarEvent[]> {
  const dayStart = startOfLocalDayMs(Date.now());
  const startMs = opts.startMs ?? dayStart;
  const endMs = opts.endMs ?? dayStart + 24 * 60 * 60 * 1000;
  const maxResults = Math.min(opts.maxResults ?? 50, 250);

  const params = new URLSearchParams({
    timeMin: new Date(startMs).toISOString(),
    timeMax: new Date(endMs).toISOString(),
    singleEvents: 'true', // expand recurring; required for orderBy=startTime
    orderBy: 'startTime',
    maxResults: String(maxResults),
  });

  const res = await authedFetch(clientId, `${BASE}?${params}`, { method: 'GET' });
  if (!res.ok) throw new Error(`List events failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const items = (json.items ?? []) as GoogleEvent[];

  return items
    .map(parseEvent)
    .filter((e): e is CalendarEvent => e !== null && e.responseStatus !== 'declined')
    .sort((a, b) => a.startMs - b.startMs);
}
