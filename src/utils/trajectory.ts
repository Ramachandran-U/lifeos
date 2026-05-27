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
  elapsedMonths: number;
  elapsedFraction: number; // 0-1
  actualProgress: number; // 0-1
  expectedProgress: number; // 0-1 (== clamped elapsedFraction)
  deltaPct: number; // (actual - expected) * 100, rounded
  status: TrajectoryStatus;
  totalSubGoals: number;
  completedSubGoals: number;
  /** Active (incomplete) sub-goal titles, nearest the root first — recalibration fodder. */
  laggingTitles: string[];
}

const DEFAULT_HORIZON_MONTHS = 36; // the canonical "3-year vision"
const ON_TRACK_BAND = 0.1; // ±10 percentage points counts as on-track
const DAYS_PER_MONTH = 30.44;

/**
 * Best-effort extract a horizon in months from a free-text timeline like
 * "3 years", "5-year plan", "18 months". Falls back to 36 months.
 */
export function parseHorizonMonths(timeline?: string | null): number {
  if (!timeline) return DEFAULT_HORIZON_MONTHS;
  const text = timeline.toLowerCase();
  const yearMatch = text.match(/(\d+(?:\.\d+)?)\s*[-\s]?year/);
  if (yearMatch) {
    const years = parseFloat(yearMatch[1]);
    if (years > 0) return Math.round(years * 12);
  }
  const monthMatch = text.match(/(\d+)\s*[-\s]?month/);
  if (monthMatch) {
    const months = parseInt(monthMatch[1], 10);
    if (months > 0) return months;
  }
  return DEFAULT_HORIZON_MONTHS;
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
  const queue = [...(childrenByParent[lifeGoalId] ?? [])];
  let total = 0;
  let completed = 0;
  const lagging: string[] = [];
  while (queue.length) {
    const g = queue.shift()!;
    total += 1;
    if (g.status === 'completed') completed += 1;
    else if (g.status === 'active') lagging.push(g.title);
    queue.push(...(childrenByParent[g.id] ?? []));
  }
  return { total, completed, lagging };
}

export function computeTrajectory(
  lifeGoal: TrajectoryGoal,
  goals: TrajectoryGoal[],
  now: Date = new Date(),
): TrajectoryResult {
  const horizonMonths = parseHorizonMonths(lifeGoal.timeline);
  const elapsedDays = Math.max(0, differenceInCalendarDays(now, new Date(lifeGoal.createdAt)));
  const elapsedMonths = Math.min(horizonMonths, elapsedDays / DAYS_PER_MONTH);
  const elapsedFraction = horizonMonths > 0 ? elapsedMonths / horizonMonths : 0;
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

  return {
    horizonMonths,
    elapsedMonths: Math.round(elapsedMonths),
    elapsedFraction,
    actualProgress,
    expectedProgress,
    deltaPct,
    status,
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
