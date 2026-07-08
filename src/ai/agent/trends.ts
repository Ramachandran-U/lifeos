/**
 * Temporal trend assembly for the agent's trend tools (flag
 * `agent_trend_tools`). The data always existed — health_logs, reflections,
 * behaviour_events — but nothing could read it AS a time series until now.
 *
 * Pure math (`summarizeSeries`, `bucketByWeek`) is exported for unit tests;
 * the `build*Trend` assemblers wrap the storage reads and return the compact
 * JSON shapes the tools hand to the model (no raw rows).
 */
import { format } from 'date-fns';
import { getSleepSeries } from '@/db/queries/health';
import { getMoodSeries } from '@/db/queries/reflections';
import { getEventsLastNDays } from '@/db/queries/behaviour';

export type TrendDirection = 'up' | 'down' | 'flat';

export interface SeriesSummary {
  count: number;
  average: number | null;
  /** Second-half mean vs first-half mean; 'flat' within ±5% or when count < 4. */
  direction: TrendDirection;
  /** Signed % change between the half-means (null when direction is undecidable). */
  changePct: number | null;
}

const FLAT_THRESHOLD_PCT = 5;

/** Compare the mean of the first half of a series to the second. Pure. */
export function summarizeSeries(values: number[]): SeriesSummary {
  const count = values.length;
  if (count === 0) return { count: 0, average: null, direction: 'flat', changePct: null };

  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const average = Number(mean(values).toFixed(2));
  if (count < 4) return { count, average, direction: 'flat', changePct: null };

  const mid = Math.floor(count / 2);
  const firstMean = mean(values.slice(0, mid));
  const secondMean = mean(values.slice(mid));
  if (firstMean === 0) return { count, average, direction: 'flat', changePct: null };

  const changePct = Number((((secondMean - firstMean) / firstMean) * 100).toFixed(1));
  const direction: TrendDirection =
    Math.abs(changePct) < FLAT_THRESHOLD_PCT ? 'flat' : changePct > 0 ? 'up' : 'down';
  return { count, average, direction, changePct };
}

/**
 * ISO-ish week bucket: the Monday of the week containing `date`. Pure.
 * Formatted locally (date-fns), NOT via toISOString — in positive-offset
 * timezones (IST) UTC conversion would shift local midnight back a day.
 */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  const dowMon0 = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dowMon0);
  return format(d, 'yyyy-MM-dd');
}

/** Count items per week bucket, oldest week first. Pure. */
export function bucketByWeek(dates: string[]): Array<{ weekOf: string; count: number }> {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const wk = weekStart(date);
    counts.set(wk, (counts.get(wk) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([weekOf, count]) => ({ weekOf, count }))
    .sort((a, b) => (a.weekOf < b.weekOf ? -1 : 1));
}

// ── storage-bound assemblers (never throw; empty shapes on failure) ─────────

export interface SleepTrend extends SeriesSummary {
  series: Array<{ date: string; sleepHours: number }>;
  note?: string;
}

export function buildSleepTrend(days: number): SleepTrend {
  try {
    const series = getSleepSeries(days);
    const summary = summarizeSeries(series.map((p) => p.sleepHours));
    return {
      ...summary,
      series,
      ...(series.length === 0
        ? { note: 'No sleep data in this window — the user may not log sleep or connect Google Fit.' }
        : {}),
    };
  } catch {
    return { count: 0, average: null, direction: 'flat', changePct: null, series: [] };
  }
}

export interface MoodTrend extends SeriesSummary {
  series: Array<{ date: string; mood: number }>;
  note?: string;
}

export function buildMoodTrend(days: number): MoodTrend {
  try {
    const series = getMoodSeries(days);
    const summary = summarizeSeries(series.map((p) => p.mood));
    return {
      ...summary,
      series,
      ...(series.length === 0
        ? { note: 'No mood data in this window — moods are logged in the evening reflection.' }
        : {}),
    };
  } catch {
    return { count: 0, average: null, direction: 'flat', changePct: null, series: [] };
  }
}

export interface CompletionTrend {
  /** Blocks completed per week, oldest first (current partial week included). */
  weekly: Array<{ weekOf: string; count: number }>;
  totalCompleted: number;
  direction: TrendDirection;
  note?: string;
}

export function buildCompletionTrend(days: number): CompletionTrend {
  try {
    const dates = getEventsLastNDays(days)
      .filter((e) => e.eventType === 'block_completed')
      .map((e) => e.createdAt.slice(0, 10));
    const weekly = bucketByWeek(dates);
    // Direction over FULL weeks only — the current partial week always looks
    // like a collapse next to a complete one.
    const currentWeek = weekStart(format(new Date(), 'yyyy-MM-dd'));
    const fullWeeks = weekly.filter((w) => w.weekOf !== currentWeek);
    const { direction } = summarizeSeries(fullWeeks.map((w) => w.count));
    return {
      weekly,
      totalCompleted: dates.length,
      direction,
      ...(dates.length === 0 ? { note: 'No completed blocks recorded in this window.' } : {}),
    };
  } catch {
    return { weekly: [], totalCompleted: 0, direction: 'flat' };
  }
}
