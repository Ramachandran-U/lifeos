import { addDays, format, parseISO, differenceInMinutes } from 'date-fns';
import { getRoutineBlocksInRange } from '@/db/queries/routine';
import type { DomainScores } from '@/utils/gamification';

export type DomainKey = keyof DomainScores;

export const MODULE_TO_DOMAIN: Record<string, DomainKey> = {
  goal: 'goals',
  health: 'health',
  finance: 'finance',
  career: 'career',
  social: 'social',
  polymath: 'polymath',
};

export const DOMAIN_ORDER: DomainKey[] = ['goals', 'health', 'finance', 'career', 'social', 'polymath'];

export const DOMAIN_LABEL: Record<DomainKey, string> = {
  goals:    'Goals',
  health:   'Health',
  finance:  'Finance',
  career:   'Career',
  social:   'Social',
  polymath: 'Mind',
};

export const DOMAIN_COLOR_KEY: Record<DomainKey, 'goal' | 'health' | 'finance' | 'career' | 'social' | 'polymath'> = {
  goals:    'goal',
  health:   'health',
  finance:  'finance',
  career:   'career',
  social:   'social',
  polymath: 'polymath',
};

function emptyMinutes(): Record<DomainKey, number> {
  return { goals: 0, health: 0, finance: 0, career: 0, social: 0, polymath: 0 };
}

interface RoutineBlockLike {
  date: string;
  startTime: string;
  endTime: string;
  module: string;
  status: string;
}

function durationMin(b: { startTime: string; endTime: string }): number {
  // Both times are "HH:mm" — treat as same-day. Cross-midnight blocks are not
  // a current pattern; if they appear later we'll switch to full ISO parsing.
  const [sh, sm] = b.startTime.split(':').map((s) => parseInt(s, 10));
  const [eh, em] = b.endTime.split(':').map((s) => parseInt(s, 10));
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return Math.max(0, mins);
}

/**
 * Aggregate completed block minutes per domain over a date range (inclusive).
 * Skipped + upcoming blocks are excluded — this is *time spent*, not time planned.
 */
export function aggregateDomainMinutes(blocks: RoutineBlockLike[]): Record<DomainKey, number> {
  const out = emptyMinutes();
  for (const b of blocks) {
    if (b.status !== 'completed' && b.status !== 'in_progress') continue;
    const domain = MODULE_TO_DOMAIN[b.module];
    if (!domain) continue;
    out[domain] += durationMin(b);
  }
  return out;
}

/**
 * Aggregate *planned* minutes per life-domain across a set of blocks, ignoring
 * status (the edit-routine preview holds blocks that aren't persisted yet, so
 * they have no status). Non-life modules (rest/work/meal) aren't in
 * MODULE_TO_DOMAIN and are intentionally dropped — this powers the
 * life-domains-only "Today's balance" bar in the routine editor.
 */
export function aggregatePlannedDomainMinutes(
  blocks: Array<{ startTime: string; endTime: string; module: string }>,
): Record<DomainKey, number> {
  const out = emptyMinutes();
  for (const b of blocks) {
    const domain = MODULE_TO_DOMAIN[b.module];
    if (!domain) continue;
    out[domain] += durationMin(b);
  }
  return out;
}

/**
 * Days N..today (inclusive) where N = today - (windowDays - 1).
 */
function rangeEndingToday(windowDays: number): { start: string; end: string } {
  const today = new Date();
  const end = format(today, 'yyyy-MM-dd');
  const start = format(addDays(today, -(windowDays - 1)), 'yyyy-MM-dd');
  return { start, end };
}

export function computeLastWeekDomainMinutes(): Record<DomainKey, number> {
  const { start, end } = rangeEndingToday(7);
  const blocks = getRoutineBlocksInRange(start, end);
  return aggregateDomainMinutes(blocks);
}

export function computePriorWeekDomainMinutes(): Record<DomainKey, number> {
  const today = new Date();
  const end = format(addDays(today, -7), 'yyyy-MM-dd');
  const start = format(addDays(today, -13), 'yyyy-MM-dd');
  const blocks = getRoutineBlocksInRange(start, end);
  return aggregateDomainMinutes(blocks);
}

export interface BalanceSummary {
  current: Record<DomainKey, number>;
  previous: Record<DomainKey, number>;
  deltas: Record<DomainKey, number>;   // current - previous
  totalCurrent: number;
  totalPrevious: number;
  /** Domains in `primaryDomains` that had zero minutes this week. */
  silentPrimary: DomainKey[];
  /** Domain with the most minutes this week (null when nothing logged). */
  topDomain: DomainKey | null;
}

export function buildBalanceSummary(
  primaryDomains: string[] = [],
): BalanceSummary {
  const current = computeLastWeekDomainMinutes();
  const previous = computePriorWeekDomainMinutes();
  const deltas = emptyMinutes();
  let totalCurrent = 0;
  let totalPrevious = 0;
  let topDomain: DomainKey | null = null;
  let topMinutes = 0;

  for (const d of DOMAIN_ORDER) {
    deltas[d] = current[d] - previous[d];
    totalCurrent += current[d];
    totalPrevious += previous[d];
    if (current[d] > topMinutes) {
      topMinutes = current[d];
      topDomain = d;
    }
  }

  const primaryKeys = primaryDomains
    .map((p) => p as DomainKey)
    .filter((p) => DOMAIN_ORDER.includes(p));
  const silentPrimary = primaryKeys.filter((p) => current[p] === 0);

  return { current, previous, deltas, totalCurrent, totalPrevious, silentPrimary, topDomain };
}
