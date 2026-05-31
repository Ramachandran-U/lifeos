/**
 * P4-04 Long-Term Trajectory Tracking.
 *
 * Answers "Are you on track for your 3-year vision?" by comparing time
 * elapsed against actual goal-tree progress. Pure + deterministic so the
 * verdict is testable and the same numbers feed the AI recalibration call.
 *
 * Expected progress is linear with elapsed time (a goal 1/3 of the way
 * through its horizon is "expected" to be 1/3 done). Actual progress is the
 * share of completed descendants in the goal tree. The gap between the two
 * drives the on-track / ahead / behind verdict.
 */

import { differenceInCalendarDays } from 'date-fns';

export type TrajectoryStatus = 'ahead' | 'on_track' | 'behind' | 'no_data';

export interface TrajectoryGoal {
  id: string;
  parentId?: string | null;
  level: string;
  status: string;
  title: string;
  timeline?: string | null;
  createdAt: string;
}

export interface TrajectoryResult {
  horizonMonths: number;
  /** True when no usable `timeline` was set and we fell back to the default
   *  horizon. The UI must not present a defaulted horizon as the user's choice. */
  horizonIsDefault: boolean;
  elapsedMonths: number;
  elapsedFraction: number; // 0-1
  actualProgress: number; // 0-1
  expectedProgress: number; // 0-1 (== clamped elapsedFraction)
  deltaPct: number; // (actual - expected) * 100, rounded
  status: TrajectoryStatus;
  /** True in the opening window (no milestone done yet AND <1 month elapsed).
   *  A pace verdict here is hollow — 0% vs 0% is trivially "on track". */
  justStarted: boolean;
  totalSubGoals: number;
  completedSubGoals: number;
  /** Active (incomplete) milestone titles, nearest the root first — recalibration fodder. */
  laggingTitles: string[];
}

const DEFAULT_HORIZON_MONTHS = 36; // the canonical "3-year vision"
const ON_TRACK_BAND = 0.1; // ±10 percentage points counts as on-track
const DAYS_PER_MONTH = 30.44;
const JUST_STARTED_MONTHS = 1; // opening window where a pace verdict is meaningless

// Only yearly + monthly nodes are "milestones". Weekly/daily are tasks — counting
// them as milestones both mislabels the figure and pollutes the progress %.
const MILESTONE_LEVELS = new Set(['yearly', 'monthly']);

/**
 * Resolve a horizon in months from a free-text timeline like "3 years",
 * "5-year plan", "18 months". `isDefault` is true when nothing parseable was
 * given and we fell back to the canonical 3-year horizon — the caller needs to
 * know so it doesn't present the fallback as a user-chosen timeline.
 */
export function resolveHorizon(timeline?: string | null): { months: number; isDefault: boolean } {
  if (timeline) {
    const text = timeline.toLowerCase();
    const yearMatch = text.match(/(\d+(?:\.\d+)?)\s*[-\s]?year/);
    if (yearMatch) {
      const years = parseFloat(yearMatch[1]);
      if (years > 0) return { months: Math.round(years * 12), isDefault: false };
    }
    const monthMatch = text.match(/(\d+)\s*[-\s]?month/);
    if (monthMatch) {
      const months = parseInt(monthMatch[1], 10);
      if (months > 0) return { months, isDefault: false };
    }
  }
  return { months: DEFAULT_HORIZON_MONTHS, isDefault: true };
}

/** Back-compat thin wrapper — months only. Prefer `resolveHorizon`. */
export function parseHorizonMonths(timeline?: string | null): number {
  return resolveHorizon(timeline).months;
}

function countTree(
  lifeGoalId: string,
  goals: TrajectoryGoal[],
): { total: number; completed: number; lagging: string[] } {
  const childrenByParent: Record<string, TrajectoryGoal[]> = {};
  for (const g of goals) {
    if (!g.parentId) continue;
    (childrenByParent[g.parentId] = childrenByParent[g.parentId] ?? []).push(g);
  }
  // Walk the whole tree, but only count milestone-level nodes toward the
  // figure and the progress %. Tasks (weekly/daily) are traversed for their
  // children but never counted as milestones.
  const queue = [...(childrenByParent[lifeGoalId] ?? [])];
  let total = 0;
  let completed = 0;
  const lagging: string[] = [];
  while (queue.length) {
    const g = queue.shift()!;
    if (MILESTONE_LEVELS.has(g.level)) {
      total += 1;
      if (g.status === 'completed') completed += 1;
      else if (g.status === 'active') lagging.push(g.title);
    }
    queue.push(...(childrenByParent[g.id] ?? []));
  }
  return { total, completed, lagging };
}

export function computeTrajectory(
  lifeGoal: TrajectoryGoal,
  goals: TrajectoryGoal[],
  now: Date = new Date(),
): TrajectoryResult {
  const { months: horizonMonths, isDefault: horizonIsDefault } = resolveHorizon(lifeGoal.timeline);
  const elapsedDays = Math.max(0, differenceInCalendarDays(now, new Date(lifeGoal.createdAt)));
  const elapsedMonthsRaw = Math.min(horizonMonths, elapsedDays / DAYS_PER_MONTH);
  const elapsedFraction = horizonMonths > 0 ? elapsedMonthsRaw / horizonMonths : 0;
  const expectedProgress = Math.min(1, Math.max(0, elapsedFraction));

  const { total, completed, lagging } = countTree(lifeGoal.id, goals);
  const actualProgress = total > 0 ? completed / total : 0;
  const deltaPct = Math.round((actualProgress - expectedProgress) * 100);

  let status: TrajectoryStatus;
  if (total === 0) {
    status = 'no_data';
  } else if (actualProgress - expectedProgress > ON_TRACK_BAND) {
    status = 'ahead';
  } else if (actualProgress - expectedProgress < -ON_TRACK_BAND) {
    status = 'behind';
  } else {
    status = 'on_track';
  }

  const justStarted =
    status !== 'no_data' && completed === 0 && elapsedMonthsRaw < JUST_STARTED_MONTHS;

  return {
    horizonMonths,
    horizonIsDefault,
    elapsedMonths: Math.round(elapsedMonthsRaw),
    elapsedFraction,
    actualProgress,
    expectedProgress,
    deltaPct,
    status,
    justStarted,
    totalSubGoals: total,
    completedSubGoals: completed,
    laggingTitles: lagging.slice(0, 5),
  };
}

/** Calendar quarter label for `date`, e.g. "2026-Q2". Drives quarterly prompts. */
export function quarterKey(date: Date = new Date()): string {
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${q}`;
}
