import { Platform } from 'react-native';
import { gte } from 'drizzle-orm';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { behaviourEvents } from '../schema';
import { subDays, format } from 'date-fns';
import {
  webInsertBehaviourEvent,
  webGetBehaviourEventsLastNDays,
  type WebBehaviourEvent,
} from '../webStorage';

const isWeb = Platform.OS === 'web';

export function logBehaviourEvent(eventType: string, module: string, metadata?: Record<string, unknown>) {
  const now = new Date();
  const record: WebBehaviourEvent = {
    id: nanoid(),
    eventType,
    module,
    metadata: metadata ? JSON.stringify(metadata) : null,
    hour: now.getHours(),
    dayOfWeek: now.getDay(),
    createdAt: now.toISOString(),
  };
  if (isWeb) {
    webInsertBehaviourEvent(record);
    return;
  }
  db.insert(behaviourEvents).values(record).run();
}

export function getEventsLastNDays(days: number): WebBehaviourEvent[] {
  if (isWeb) return webGetBehaviourEventsLastNDays(days);
  const cutoff = format(subDays(new Date(), days), 'yyyy-MM-dd');
  return db.select().from(behaviourEvents)
    .where(gte(behaviourEvents.createdAt, cutoff))
    .all() as unknown as WebBehaviourEvent[];
}

export function getEventCountsByHour(days: number = 30) {
  const events = getEventsLastNDays(days);
  const hourCounts: Record<number, number> = {};
  for (const e of events) {
    hourCounts[e.hour] = (hourCounts[e.hour] ?? 0) + 1;
  }
  return hourCounts;
}

export function getCompletionsByDayOfWeek(days: number = 30) {
  const events = getEventsLastNDays(days).filter(e => e.eventType.includes('completed'));
  const dayCounts: Record<number, number> = {};
  for (const e of events) {
    dayCounts[e.dayOfWeek] = (dayCounts[e.dayOfWeek] ?? 0) + 1;
  }
  return dayCounts;
}

export type UsageRange = 'day' | 'week';

export interface UsageStats {
  totalMinutes: number;
  /** Bucketed minutes for charting: 24 hour-buckets (day) or 7 day-buckets (week, Mon→Sun). */
  buckets: number[];
  byModule: Record<string, number>;
  topEvents: Array<{ type: string; count: number }>;
  searches: Array<{ query: string; scope: string; when: string }>;
}

export function getUsageStats(range: UsageRange): UsageStats {
  const days = range === 'day' ? 1 : 7;
  const events = getEventsLastNDays(days);

  const cutoff = new Date();
  if (range === 'day') {
    cutoff.setHours(0, 0, 0, 0);
  } else {
    cutoff.setDate(cutoff.getDate() - 6);
    cutoff.setHours(0, 0, 0, 0);
  }
  const cutoffMs = cutoff.getTime();

  const inRange = events.filter((e) => new Date(e.createdAt).getTime() >= cutoffMs);

  const byModule: Record<string, number> = {};
  const eventCounts: Record<string, number> = {};
  const buckets: number[] = range === 'day' ? Array(24).fill(0) : Array(7).fill(0);
  const searches: UsageStats['searches'] = [];
  let totalMs = 0;

  for (const e of inRange) {
    if (e.eventType !== 'screen_view') {
      eventCounts[e.eventType] = (eventCounts[e.eventType] ?? 0) + 1;
    }
    if (e.eventType === 'search_query') {
      try {
        const meta = e.metadata ? (JSON.parse(e.metadata) as { query?: string; scope?: string }) : {};
        if (meta.query) {
          searches.push({ query: meta.query, scope: meta.scope ?? e.module, when: e.createdAt });
        }
      } catch { /* ignore */ }
      continue;
    }
    if (e.eventType !== 'screen_view') continue;

    let durationMs = 0;
    try {
      const meta = e.metadata ? (JSON.parse(e.metadata) as { durationMs?: number }) : {};
      durationMs = typeof meta.durationMs === 'number' ? meta.durationMs : 0;
    } catch { /* ignore */ }
    if (durationMs <= 0) continue;

    totalMs += durationMs;
    byModule[e.module] = (byModule[e.module] ?? 0) + durationMs;

    if (range === 'day') {
      buckets[e.hour] += durationMs;
    } else {
      const eventDate = new Date(e.createdAt);
      eventDate.setHours(0, 0, 0, 0);
      const dayIndex = Math.floor((eventDate.getTime() - cutoffMs) / 86_400_000);
      if (dayIndex >= 0 && dayIndex < 7) buckets[dayIndex] += durationMs;
    }
  }

  // Convert ms → minutes for display.
  const toMinutes = (ms: number) => Math.round(ms / 60_000);
  const byModuleMin: Record<string, number> = {};
  for (const [k, v] of Object.entries(byModule)) byModuleMin[k] = toMinutes(v);
  const bucketsMin = buckets.map(toMinutes);

  const topEvents = Object.entries(eventCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));

  searches.sort((a, b) => (a.when < b.when ? 1 : -1));

  return {
    totalMinutes: toMinutes(totalMs),
    buckets: bucketsMin,
    byModule: byModuleMin,
    topEvents,
    searches: searches.slice(0, 10),
  };
}

export function generateWeeklyInsight(): string | null {
  const events = getEventsLastNDays(7);
  if (events.length < 3) return null;

  const hourCounts = getEventCountsByHour(7);
  const peakHour = Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)[0];

  const completedEvents = events.filter(e => e.eventType.includes('completed'));
  const totalEvents = events.length;
  const completionRate = totalEvents > 0 ? Math.round((completedEvents.length / totalEvents) * 100) : 0;

  const morningEvents = events.filter(e => e.hour < 12).length;
  const afternoonEvents = events.filter(e => e.hour >= 12).length;
  const prefersMorning = morningEvents > afternoonEvents;

  if (peakHour) {
    const hourNum = parseInt(peakHour[0], 10);
    const period = hourNum < 12 ? 'AM' : 'PM';
    const displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
    return `You're most productive around ${displayHour} ${period}. ${prefersMorning ? 'Morning tasks have a higher completion rate.' : 'You tend to get more done in the afternoon.'} This week: ${completionRate}% completion rate across ${totalEvents} actions.`;
  }

  return `This week you completed ${completionRate}% of your tracked actions (${completedEvents.length}/${totalEvents}). ${prefersMorning ? 'Mornings are your sweet spot.' : 'Afternoons are when you shine.'}`;
}
