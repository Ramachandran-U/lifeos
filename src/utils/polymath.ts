import { format, parseISO, startOfWeek, isWithinInterval, addDays } from 'date-fns';

export interface ExplorationEntry {
  interestId: string;
  date: string; // YYYY-MM-DD
  minutesSpent: number;
}

/**
 * Sums minutes per interest for the ISO week containing `anchor` (Monday → Sunday).
 * Pure — callers pass in the log and the anchor date (defaults to today).
 */
export function weeklyMinutesByInterest(
  log: ExplorationEntry[],
  anchor: Date = new Date(),
): Record<string, number> {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  const end = addDays(start, 7);
  const result: Record<string, number> = {};
  for (const entry of log) {
    const date = parseISO(entry.date);
    if (isWithinInterval(date, { start, end })) {
      result[entry.interestId] = (result[entry.interestId] ?? 0) + entry.minutesSpent;
    }
  }
  return result;
}

/**
 * Rolls up weekly-minutes-actual for one interest using the full log.
 */
export function actualForInterest(
  interestId: string,
  log: ExplorationEntry[],
  anchor: Date = new Date(),
): number {
  return weeklyMinutesByInterest(log, anchor)[interestId] ?? 0;
}

/**
 * Progress ratio clamped to [0, 1.5] so the UI can show overshoot without blowing past 150%.
 */
export function progressRatio(actual: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(1.5, actual / target);
}

export function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
