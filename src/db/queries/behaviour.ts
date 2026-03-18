import { eq, sql, and, gte } from 'drizzle-orm';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { behaviourEvents } from '../schema';
import { subDays, format } from 'date-fns';

export function logBehaviourEvent(eventType: string, module: string, metadata?: Record<string, unknown>) {
  const now = new Date();
  db.insert(behaviourEvents).values({
    id: nanoid(),
    eventType,
    module,
    metadata: metadata ? JSON.stringify(metadata) : null,
    hour: now.getHours(),
    dayOfWeek: now.getDay(),
    createdAt: now.toISOString(),
  }).run();
}

export function getEventsLastNDays(days: number) {
  const cutoff = format(subDays(new Date(), days), 'yyyy-MM-dd');
  return db.select().from(behaviourEvents)
    .where(gte(behaviourEvents.createdAt, cutoff))
    .all();
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
