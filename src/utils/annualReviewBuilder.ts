/**
 * Local aggregator for the Annual Life Review (P4-03). Pulls a year of
 * on-device activity across all six domains into the AI input payload. Stays
 * on-device — only aggregate counts/minutes are produced, never raw contact
 * or health rows.
 *
 * NOTE: this performs several synchronous Drizzle `.all()` reads (a 365-day
 * routine-block scan among them), which briefly blocks the JS thread. That is
 * acceptable because the Annual Review is gated behind `useAnnualReviewStore`
 * and only runs once per calendar year (or on an explicit manual refresh), not
 * on every screen open. If routine history grows very large, move this
 * aggregation to a background task.
 */

import { addDays, format } from 'date-fns';
import { getRoutineBlocksInRange } from '@/db/queries/routine';
import { getGoalsByUser } from '@/db/queries/goals';
import { getContactsByUser, computeSocialScore } from '@/db/queries/social';
import { getOrCreateGamification } from '@/db/queries/gamification';
import { aggregateDomainMinutes } from './routineBalance';
import { computeLifeScore } from './lifeScore';
import type { DomainScores } from './gamification';
import type { AnnualReviewInput } from '@/ai/types';

const WINDOW_DAYS = 365;

function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export function buildAnnualReviewInput(
  userId: string,
  name: string | null,
  startScores?: Partial<DomainScores> | null,
): AnnualReviewInput {
  const today = new Date();
  const start = format(addDays(today, -(WINDOW_DAYS - 1)), 'yyyy-MM-dd');
  const end = format(today, 'yyyy-MM-dd');

  const blocks = getRoutineBlocksInRange(start, end);
  const blocksPlanned = blocks.length;
  const blocksCompleted = blocks.filter((b) => b.status === 'completed').length;
  const completionRate = blocksPlanned === 0 ? 0 : blocksCompleted / blocksPlanned;

  const goalsList = getGoalsByUser(userId);
  const goalsTotal = goalsList.length;
  const goalsCompleted = goalsList.filter((g) => g.status === 'completed').length;

  const game = getOrCreateGamification(userId);
  const currentScores = safeParse<Record<string, number>>(game.domainScores, {});
  const streaks = safeParse<Record<string, { count?: number }>>(game.streaks, {});
  const badges = safeParse<unknown[]>(game.badges, []);

  // Coalesce a loose score record into the full DomainScores shape, tolerating
  // the legacy `mind` key (renamed to `polymath`, BUG-009).
  const normScores = (s: Record<string, number>): DomainScores => ({
    goals: s.goals ?? 0,
    health: s.health ?? 0,
    finance: s.finance ?? 0,
    career: s.career ?? 0,
    social: s.social ?? 0,
    polymath: s.polymath ?? s.mind ?? 0,
  });

  const currentLifeScore = computeLifeScore(normScores(currentScores));
  const startLifeScore = startScores
    ? computeLifeScore(normScores({ ...currentScores, ...startScores }))
    : currentLifeScore;

  const topStreaks = Object.entries(streaks)
    .map(([key, v]) => ({ key, count: v?.count ?? 0 }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const contacts = getContactsByUser(userId);

  return {
    windowDays: WINDOW_DAYS,
    name,
    goals: { total: goalsTotal, completed: goalsCompleted },
    routine: { blocksPlanned, blocksCompleted, completionRate },
    domainMinutes: aggregateDomainMinutes(blocks),
    lifeScore: { current: currentLifeScore, start: startLifeScore },
    topStreaks,
    totalXP: game.totalXP,
    badgeCount: badges.length,
    social: {
      contacts: contacts.length,
      inCadencePct: computeSocialScore(contacts),
    },
  };
}
