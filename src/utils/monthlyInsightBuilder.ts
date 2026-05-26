/**
 * Local aggregator that builds the input payload for the monthly insight AI.
 * Sources purely from on-device data — routine blocks, behaviour events,
 * inferred preferences — so no PII or contact info ever leaves the device.
 */

import { addDays, format } from 'date-fns';
import { getRoutineBlocksInRange } from '@/db/queries/routine';
import { getEventsLastNDays } from '@/db/queries/behaviour';
import { aggregateDomainMinutes } from './routineBalance';
import type { MonthlyInsightReportInput, UserProfile } from '@/ai/types';

const WINDOW_DAYS = 28;

function range(): { start: string; end: string } {
  const today = new Date();
  return {
    start: format(addDays(today, -(WINDOW_DAYS - 1)), 'yyyy-MM-dd'),
    end: format(today, 'yyyy-MM-dd'),
  };
}

export function buildMonthlyInsightInput(profile: UserProfile): MonthlyInsightReportInput {
  const { start, end } = range();
  const blocks = getRoutineBlocksInRange(start, end);

  const blocksPlanned = blocks.length;
  const blocksCompleted = blocks.filter((b) => b.status === 'completed').length;
  const blocksSkipped = blocks.filter((b) => b.status === 'skipped').length;
  const completionRate = blocksPlanned === 0 ? 0 : blocksCompleted / blocksPlanned;

  const domainMinutes = aggregateDomainMinutes(blocks);

  // Top behaviour event types in the window.
  const events = getEventsLastNDays(WINDOW_DAYS);
  const counts: Record<string, number> = {};
  for (const e of events) counts[e.eventType] = (counts[e.eventType] ?? 0) + 1;
  const topEvents = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([type, count]) => ({ type, count }));

  return {
    windowDays: WINDOW_DAYS,
    totals: { blocksCompleted, blocksSkipped, blocksPlanned, completionRate },
    domainMinutes,
    inferredPreferences: {
      productiveHours: profile.inferredPreferences.productiveHours,
      preferredBlockMinutes: profile.inferredPreferences.preferredBlockMinutes,
      droppedHabits: profile.inferredPreferences.droppedHabits,
      preferredRestDays: profile.inferredPreferences.preferredRestDays,
    },
    topEvents,
  };
}
