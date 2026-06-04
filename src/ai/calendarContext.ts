/**
 * Turns the user's real Google Calendar commitments into `RagItem`s for the
 * Routine Planner's retrieve step, so the plan is built *around* actual
 * meetings/busy windows instead of into a vacuum.
 *
 * Two pieces:
 *   - `eventsToRagItems()` — a pure summariser (no I/O), unit-tested directly.
 *   - `buildCalendarContext()` — the async wrapper that reads the calendar and
 *     is defensive end-to-end: if the calendar isn't connected, the client id
 *     is missing, or the network call fails, it returns `[]` so planning is
 *     never blocked. Google OAuth is web-only, so on native this naturally
 *     no-ops (no stored token → not connected).
 *
 * Reuses the `calendar.events` scope the write path already holds — no new
 * permission or consent.
 */

import type { RagItem } from './rag/retrieve';
import { listCalendarEvents, type CalendarEvent } from '@/integrations/googleCalendar/client';
import { isCalendarConnected } from '@/integrations/googleCalendar/oauth';
import { todayKey } from '@/utils/dateKeys';

/** A day with this many minutes of commitments is "heavy" — flag it to the planner. */
const HEAVY_DAY_MINUTES = 240;
/** ...or this many discrete events. */
const HEAVY_DAY_EVENT_COUNT = 5;
/** Don't list more than this many commitments inline; summarise the rest. */
const MAX_INLINE_EVENTS = 8;

function label(e: CalendarEvent): string {
  if (e.allDay) return `all-day ${e.title}`;
  return `${e.startTime}–${e.endTime} ${e.title}`;
}

function timedMinutes(events: CalendarEvent[]): number {
  return events
    .filter((e) => !e.allDay)
    .reduce((sum, e) => sum + Math.max(0, Math.round((e.endMs - e.startMs) / 60000)), 0);
}

/**
 * Pure: map a day's events to at most three high-signal context sentences.
 * `date` is the YYYY-MM-DD the events belong to (used in the prose).
 */
export function eventsToRagItems(events: CalendarEvent[], date: string): RagItem[] {
  if (events.length === 0) {
    return [
      {
        id: `cal:clear:${date}`,
        text: `Calendar is clear on ${date} — no external commitments to plan around, so routine blocks can be placed freely.`,
        metadata: { kind: 'calendar', clear: true },
      },
    ];
  }

  const items: RagItem[] = [];

  const shown = events.slice(0, MAX_INLINE_EVENTS).map(label);
  const overflow = events.length - shown.length;
  const list = shown.join('; ') + (overflow > 0 ? `; +${overflow} more` : '');
  items.push({
    id: `cal:today:${date}`,
    text:
      `On ${date} there ${events.length === 1 ? 'is' : 'are'} ${events.length} calendar ` +
      `commitment${events.length === 1 ? '' : 's'} that block time: ${list}. ` +
      `Schedule routine blocks around these — do not place blocks over them.`,
    metadata: { kind: 'calendar', count: events.length },
  });

  const mins = timedMinutes(events);
  if (mins >= HEAVY_DAY_MINUTES || events.length >= HEAVY_DAY_EVENT_COUNT) {
    const hours = (mins / 60).toFixed(1).replace(/\.0$/, '');
    items.push({
      id: `cal:load:${date}`,
      text:
        `Heavy schedule on ${date}: about ${hours}h of meetings across ${events.length} ` +
        `events. Keep new commitments light, favour shorter blocks, and protect recovery time.`,
      metadata: { kind: 'calendar', heavy: true, minutes: mins },
    });
  }

  return items;
}

/**
 * Read today's calendar events defensively. Returns:
 *   - `null`   → calendar unavailable (not connected, no client id, or API error)
 *   - `[]`     → connected but today is clear
 *   - events   → today's commitments, sorted by start time
 *
 * Never throws. Shared by the planner context (below) and the "what should I do
 * next?" agent's `getTodayCalendar` tool, so both treat an unavailable calendar
 * identically. Google OAuth is web-only, so this naturally returns `null` on
 * native (no stored token → not connected).
 */
export async function fetchTodayCalendarEvents(): Promise<CalendarEvent[] | null> {
  try {
    if (!isCalendarConnected()) return null;
    const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return null;
    return await listCalendarEvents(clientId);
  } catch {
    // Token expired, offline, or API error — caller plans without it.
    return null;
  }
}

/**
 * Read today's calendar (if connected) and return planner context items.
 * Always resolves — never throws — so a missing/expired calendar connection
 * can't break planning. `null` (unavailable) and `[]` (clear day) differ: a
 * connected-but-clear day still emits the "calendar is clear" signal.
 */
export async function buildCalendarContext(): Promise<RagItem[]> {
  const events = await fetchTodayCalendarEvents();
  if (events === null) return [];
  return eventsToRagItems(events, todayKey());
}
