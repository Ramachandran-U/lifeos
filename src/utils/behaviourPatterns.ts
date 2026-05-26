/**
 * Local, deterministic detectors that turn routine-block history and
 * behaviour events into adaptation suggestions. Pure computation — no AI call
 * — so the Today screen can render suggestions with no network round-trip and
 * no cost. The AI budget is spent in the monthly insight report instead.
 *
 * Each suggestion has a stable id (so the store can permanently dismiss it
 * without resurfacing the same pattern next refresh), a confidence label, and
 * a structured `apply` payload that the apply path uses to rewrite *future*
 * blocks. Historical blocks are never touched.
 */

import { format, addDays } from 'date-fns';
import { getRoutineBlocksInRange } from '@/db/queries/routine';

export type SuggestionKind =
  | 'workout_timing'
  | 'session_length'
  | 'weekend_drift'
  | 'dropped_habit'
  | 'productive_hour_shift';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface SuggestionApplyRewriteTime {
  type: 'rewrite_time';
  titleSubstring: string; // case-insensitive match against block.title
  newStartTime: string;   // "HH:MM"
  newEndTime: string;     // "HH:MM"
}
export interface SuggestionApplyShrinkDuration {
  type: 'shrink_duration';
  titleSubstring: string;
  targetDurationMin: number;
}
export interface SuggestionApplyDropTitle {
  type: 'drop_title';
  titleSubstring: string;
}
export interface SuggestionApplyRegenerateWeek {
  type: 'regenerate_week';
}

export type SuggestionApply =
  | SuggestionApplyRewriteTime
  | SuggestionApplyShrinkDuration
  | SuggestionApplyDropTitle
  | SuggestionApplyRegenerateWeek;

export interface BehaviourSuggestion {
  id: string;             // deterministic — same input ⇒ same id
  kind: SuggestionKind;
  headline: string;
  rationale: string;      // one sentence, cites the observed data point
  confidence: ConfidenceLevel;
  apply: SuggestionApply;
}

interface BlockLike {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  module: string;
  status: string;
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((s) => parseInt(s, 10));
  return h * 60 + (m || 0);
}
function fromMin(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function durationMin(b: BlockLike): number {
  const d = toMin(b.endTime) - toMin(b.startTime);
  return d > 0 ? d : 0;
}
function hourOf(hhmm: string): number {
  return Math.floor(toMin(hhmm) / 60);
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function lastNDaysBlocks(days: number): BlockLike[] {
  const today = new Date();
  const end = format(today, 'yyyy-MM-dd');
  const start = format(addDays(today, -(days - 1)), 'yyyy-MM-dd');
  const blocks = getRoutineBlocksInRange(start, end) as BlockLike[];
  return blocks;
}

// ─── Detectors ───────────────────────────────────────────────────────────────

/**
 * If workout-titled blocks at the user's current workout hour complete at <50%
 * but another hour completes at >70% (across ≥3 occurrences each), suggest the
 * shift. Picks the highest-completion alternative hour.
 */
function detectWorkoutTiming(blocks: BlockLike[]): BehaviourSuggestion | null {
  const workouts = blocks.filter((b) => /workout|gym|run|lift/i.test(b.title));
  if (workouts.length < 6) return null;

  const byHour: Record<number, { total: number; done: number; durationMin: number; sample: BlockLike }> = {};
  for (const w of workouts) {
    const h = hourOf(w.startTime);
    if (!byHour[h]) byHour[h] = { total: 0, done: 0, durationMin: durationMin(w), sample: w };
    byHour[h].total += 1;
    if (w.status === 'completed') byHour[h].done += 1;
  }
  const stats = Object.entries(byHour)
    .map(([h, s]) => ({ hour: Number(h), ...s, rate: s.done / s.total }))
    .filter((s) => s.total >= 3);

  const worst = stats.find((s) => s.rate < 0.5);
  if (!worst) return null;
  const best = [...stats].filter((s) => s.hour !== worst.hour && s.rate > 0.7).sort((a, b) => b.rate - a.rate)[0];
  if (!best) return null;

  const dur = worst.durationMin || 45;
  const newStartMin = best.hour * 60 + (toMin(best.sample.startTime) % 60);
  const newEndMin = newStartMin + dur;

  return {
    id: `workout_timing:${worst.hour}->${best.hour}`,
    kind: 'workout_timing',
    headline: `Move workouts from ${worst.hour}:00 to ${best.hour}:00`,
    rationale: `Workouts at ${worst.hour}:00 complete ${Math.round(worst.rate * 100)}% of the time. At ${best.hour}:00 you hit ${Math.round(best.rate * 100)}%.`,
    confidence: best.rate - worst.rate >= 0.4 ? 'high' : 'medium',
    apply: {
      type: 'rewrite_time',
      titleSubstring: 'workout',
      newStartTime: fromMin(newStartMin),
      newEndTime: fromMin(newEndMin),
    },
  };
}

/**
 * If the median *completed* block duration is at least 15 min shorter than the
 * median *planned* duration, propose shrinking long planned blocks toward the
 * completion-rate-friendly length.
 */
function detectSessionLength(blocks: BlockLike[]): BehaviourSuggestion | null {
  const planned = blocks.map(durationMin).filter((d) => d > 0);
  const completed = blocks
    .filter((b) => b.status === 'completed')
    .map(durationMin)
    .filter((d) => d > 0);
  if (planned.length < 10 || completed.length < 5) return null;

  const medPlanned = median(planned) ?? 0;
  const medCompleted = median(completed) ?? 0;
  if (medPlanned - medCompleted < 15) return null;

  // Find the most common long-planned title that has the worst completion rate.
  const titleStats: Record<string, { planned: number; done: number; totalDuration: number }> = {};
  for (const b of blocks) {
    const t = b.title.trim();
    if (!t) continue;
    if (!titleStats[t]) titleStats[t] = { planned: 0, done: 0, totalDuration: 0 };
    titleStats[t].planned += 1;
    if (b.status === 'completed') titleStats[t].done += 1;
    titleStats[t].totalDuration += durationMin(b);
  }
  const worstLong = Object.entries(titleStats)
    .map(([t, s]) => ({ title: t, ...s, avgDuration: s.totalDuration / s.planned }))
    .filter((s) => s.planned >= 3 && s.avgDuration > medCompleted + 15)
    .sort((a, b) => a.done / a.planned - b.done / b.planned)[0];
  if (!worstLong) return null;

  return {
    id: `session_length:${worstLong.title.toLowerCase().replace(/\s+/g, '_')}`,
    kind: 'session_length',
    headline: `Shrink "${worstLong.title}" to ${medCompleted} min`,
    rationale: `You typically finish ${medCompleted}-min sessions but these blocks are planned at ${Math.round(worstLong.avgDuration)} min — only ${Math.round((worstLong.done / worstLong.planned) * 100)}% completed.`,
    confidence: worstLong.planned >= 5 ? 'high' : 'medium',
    apply: {
      type: 'shrink_duration',
      titleSubstring: worstLong.title,
      targetDurationMin: medCompleted,
    },
  };
}

/**
 * Weekend completion rate substantially lower than weekday rate (and enough
 * data to be meaningful). Recommends regenerating the week — the routine
 * builder will produce a lighter weekend automatically (P3-03 rule).
 */
function detectWeekendDrift(blocks: BlockLike[]): BehaviourSuggestion | null {
  let wkdayTotal = 0, wkdayDone = 0, wkendTotal = 0, wkendDone = 0;
  for (const b of blocks) {
    const dow = new Date(`${b.date}T00:00:00`).getDay();
    const isWeekend = dow === 0 || dow === 6;
    const done = b.status === 'completed' ? 1 : 0;
    if (isWeekend) { wkendTotal += 1; wkendDone += done; }
    else           { wkdayTotal += 1; wkdayDone += done; }
  }
  if (wkendTotal < 4 || wkdayTotal < 8) return null;
  const wkend = wkendDone / wkendTotal;
  const wkday = wkdayDone / wkdayTotal;
  if (wkend >= wkday * 0.5) return null;

  return {
    id: 'weekend_drift',
    kind: 'weekend_drift',
    headline: 'Lighten your weekend plan',
    rationale: `Weekend completion is ${Math.round(wkend * 100)}% vs ${Math.round(wkday * 100)}% on weekdays. The current plan is asking too much.`,
    confidence: wkend < wkday * 0.3 ? 'high' : 'medium',
    apply: { type: 'regenerate_week' },
  };
}

/**
 * Surfaces a dropped habit — same heuristic profileLearning uses, but as an
 * actionable card rather than just an inferred preference the planner consumes
 * silently.
 */
function detectDroppedHabit(blocks: BlockLike[]): BehaviourSuggestion | null {
  const stats: Record<string, { skipped: number; done: number }> = {};
  for (const b of blocks) {
    const t = b.title.trim();
    if (!t) continue;
    if (!stats[t]) stats[t] = { skipped: 0, done: 0 };
    if (b.status === 'skipped') stats[t].skipped += 1;
    else if (b.status === 'completed') stats[t].done += 1;
  }
  const dropped = Object.entries(stats)
    .filter(([, s]) => s.skipped >= 3 && s.skipped > s.done)
    .sort(([, a], [, b]) => b.skipped - a.skipped)[0];
  if (!dropped) return null;

  const [title, s] = dropped;
  return {
    id: `dropped_habit:${title.toLowerCase().replace(/\s+/g, '_')}`,
    kind: 'dropped_habit',
    headline: `Drop "${title}" from your routine?`,
    rationale: `You've skipped this ${s.skipped} times and completed it ${s.done}. Either shrink it or take it off the plan.`,
    confidence: s.skipped >= 5 ? 'high' : 'medium',
    apply: { type: 'drop_title', titleSubstring: title },
  };
}

/**
 * Productive hour shifted noticeably between the prior cycle and the recent
 * one. Only fires when both windows have enough data.
 */
function detectProductiveHourShift(blocks: BlockLike[]): BehaviourSuggestion | null {
  const completed = blocks.filter((b) => b.status === 'completed');
  if (completed.length < 14) return null;

  const today = new Date();
  const splitDate = format(addDays(today, -14), 'yyyy-MM-dd');
  const older = completed.filter((b) => b.date < splitDate);
  const newer = completed.filter((b) => b.date >= splitDate);
  if (older.length < 6 || newer.length < 6) return null;

  const peakHour = (arr: BlockLike[]): number => {
    const counts: Record<number, number> = {};
    for (const b of arr) {
      const h = hourOf(b.startTime);
      counts[h] = (counts[h] ?? 0) + 1;
    }
    return Number(Object.entries(counts).sort(([, a], [, b]) => b - a)[0][0]);
  };
  const oldPeak = peakHour(older);
  const newPeak = peakHour(newer);
  if (Math.abs(newPeak - oldPeak) < 3) return null;

  return {
    id: `productive_hour_shift:${oldPeak}->${newPeak}`,
    kind: 'productive_hour_shift',
    headline: `Your peak hour shifted from ${oldPeak}:00 to ${newPeak}:00`,
    rationale: `Across the last 2 weeks, deep work has landed around ${newPeak}:00 instead of ${oldPeak}:00. Worth letting the planner know.`,
    confidence: 'medium',
    apply: { type: 'regenerate_week' },
  };
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

export interface DetectOptions {
  /** Past suggestion ids the user has dismissed — filtered out of results. */
  dismissedIds?: string[];
  /** Past suggestion ids already applied — filtered out of results. */
  appliedIds?: string[];
  /** How many days of history to look at (default 28). */
  lookbackDays?: number;
}

export function detectBehaviourSuggestions(opts: DetectOptions = {}): BehaviourSuggestion[] {
  const lookback = opts.lookbackDays ?? 28;
  let blocks: BlockLike[] = [];
  try {
    blocks = lastNDaysBlocks(lookback);
  } catch {
    return [];
  }

  const detectors = [
    detectWorkoutTiming,
    detectSessionLength,
    detectWeekendDrift,
    detectDroppedHabit,
    detectProductiveHourShift,
  ];
  const out: BehaviourSuggestion[] = [];
  for (const d of detectors) {
    try {
      const s = d(blocks);
      if (s) out.push(s);
    } catch { /* a single detector failure shouldn't kill the rest */ }
  }

  const dismissed = new Set(opts.dismissedIds ?? []);
  const applied = new Set(opts.appliedIds ?? []);
  return out
    .filter((s) => !dismissed.has(s.id) && !applied.has(s.id))
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 } as const;
      return order[a.confidence] - order[b.confidence];
    });
}
