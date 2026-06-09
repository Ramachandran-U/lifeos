import { differenceInDays, parseISO } from 'date-fns';
import type { StreakData } from '@/utils/gamification';

/**
 * Streak protection engine (streak_protection_v1) — pure, clock-injected.
 *
 * Wraps the legacy updateStreak rules (same-day no-op, +1 day increments,
 * 2-day gap consumes the free grace) and adds:
 *  - earned streak FREEZES, auto-consumed when a streak would otherwise reset
 *  - milestone tier detection (7/30/100/365) for tiered celebrations
 *  - a 24h recovery window after a genuine loss (restoreFromLoss)
 *
 * Compassion constraint: a loss is recorded gently (lastLoss) so the UI can
 * offer recovery — never as a punitive state. Freezes are earned through XP
 * (see FREEZE_EARN_XP in useGameStore), never bought.
 *
 * All dates are device-local YYYY-MM-DD strings, injected by the caller — no
 * `new Date()` in here, so tests are deterministic.
 */

export const MILESTONE_TIERS = [7, 30, 100, 365] as const;
export type MilestoneTier = (typeof MILESTONE_TIERS)[number];

/** Freezes bankable at once. Overflow earn-progress is held, never lost. */
export const MAX_FREEZES_BANKED = 2;

/** XP routed through grantXP that earns one streak freeze. */
export const FREEZE_EARN_XP = 200;

export interface FreezeAccrual {
  freezeProgressXP: number;
  streakFreezes: number;
  /** Freezes newly earned by this grant (0 when the bank was already full). */
  freezesEarned: number;
}

/**
 * Accrue earned XP toward the freeze bank. Deliberately NOT a deduction from
 * totalXP — that would de-level users (levelFromXP is pure in totalXP), which
 * reads as punishment. When the bank is full, progress holds at one full
 * freeze's worth so spending a freeze immediately re-earns it from held
 * progress — effort is never wasted.
 */
export function accrueFreezeProgress(
  progressXP: number,
  banked: number,
  amount: number,
): FreezeAccrual {
  let p = Math.max(0, progressXP) + Math.max(0, amount);
  let b = Math.max(0, banked);
  let earned = 0;
  while (p >= FREEZE_EARN_XP && b < MAX_FREEZES_BANKED) {
    p -= FREEZE_EARN_XP;
    b += 1;
    earned += 1;
  }
  if (b >= MAX_FREEZES_BANKED) p = Math.min(p, FREEZE_EARN_XP);
  return { freezeProgressXP: p, streakFreezes: b, freezesEarned: earned };
}

export interface AdvanceStreakInput {
  /** Device-local YYYY-MM-DD for "now". */
  today: string;
  /** Freezes currently banked for this user (shared across streak types). */
  freezesAvailable: number;
}

export interface AdvanceStreakResult {
  next: StreakData;
  /** True when a banked freeze was spent to preserve the count. */
  freezeConsumed: boolean;
  /** True when the streak genuinely reset (gap too large, nothing to spend). */
  lost: boolean;
  /** The tier crossed by this advance (7/30/100/365), or null. */
  milestoneCrossed: MilestoneTier | null;
}

function withDerived(base: StreakData, count: number): Pick<StreakData, 'best' | 'milestones'> {
  return {
    best: Math.max(base.best ?? 0, count),
    milestones: base.milestones ?? [],
  };
}

function crossedTier(prevCount: number, nextCount: number, celebrated: number[]): MilestoneTier | null {
  for (const tier of MILESTONE_TIERS) {
    if (nextCount >= tier && prevCount < tier && !celebrated.includes(tier)) return tier;
  }
  return null;
}

/**
 * Advance a streak for an activity logged `today`. Mirrors updateStreak's
 * ladder, with a freeze rescuing the two would-reset rungs:
 *
 *   gap 0            → no-op (already logged today)
 *   gap 1            → count + 1
 *   gap 2, grace free→ count preserved, grace consumed (legacy behaviour)
 *   gap 2 grace used,
 *   or gap 3–4       → FREEZE rescues: count + 1, freeze consumed
 *   gap > 4, or no
 *   freeze banked    → genuine loss: reset to 1, lastLoss recorded
 */
export function advanceStreak(streak: StreakData, input: AdvanceStreakInput): AdvanceStreakResult {
  const { today, freezesAvailable } = input;
  const celebrated = streak.milestones ?? [];

  const fresh = (count: number, partial?: Partial<StreakData>): StreakData => ({
    ...streak,
    count,
    lastDate: today,
    graceUsed: false,
    ...withDerived(streak, count),
    ...partial,
  });

  if (!streak.lastDate) {
    const next = fresh(1, { lastLoss: null });
    return { next, freezeConsumed: false, lost: false, milestoneCrossed: crossedTier(0, 1, celebrated) };
  }

  const gap = differenceInDays(parseISO(today), parseISO(streak.lastDate));

  if (gap <= 0) {
    return { next: streak, freezeConsumed: false, lost: false, milestoneCrossed: null };
  }

  if (gap === 1) {
    const next = fresh(streak.count + 1, { lastLoss: null });
    return {
      next,
      freezeConsumed: false,
      lost: false,
      milestoneCrossed: crossedTier(streak.count, next.count, celebrated),
    };
  }

  if (gap === 2 && !streak.graceUsed) {
    // Legacy free grace: count preserved, no increment.
    const next: StreakData = { ...streak, ...withDerived(streak, streak.count), lastDate: today, graceUsed: true, lastLoss: null };
    return { next, freezeConsumed: false, lost: false, milestoneCrossed: null };
  }

  if (gap <= 4 && freezesAvailable > 0) {
    // A banked freeze bridges the missed days; today's activity still counts.
    const next = fresh(streak.count + 1, { lastLoss: null });
    return {
      next,
      freezeConsumed: true,
      lost: false,
      milestoneCrossed: crossedTier(streak.count, next.count, celebrated),
    };
  }

  // Genuine loss — reset, remember what was lost so recovery can restore it.
  const next = fresh(1, { lastLoss: { count: streak.count, date: today } });
  return { next, freezeConsumed: false, lost: true, milestoneCrossed: crossedTier(0, 1, celebrated) };
}

/**
 * Recovery: if the user acts within a day of a loss, restore the run as if it
 * never broke (lostCount + 1 covers today's activity). Returns null when the
 * window has passed or there is nothing to restore.
 */
export function restoreFromLoss(streak: StreakData, today: string): StreakData | null {
  const loss = streak.lastLoss;
  if (!loss || loss.count <= 0) return null;
  const gap = differenceInDays(parseISO(today), parseISO(loss.date));
  if (gap < 0 || gap > 1) return null;
  const count = loss.count + 1;
  return {
    ...streak,
    count,
    lastDate: today,
    graceUsed: false,
    ...withDerived(streak, count),
    lastLoss: null,
  };
}

/** Record a celebrated tier so it never re-fires for this streak. */
export function markMilestoneCelebrated(streak: StreakData, tier: MilestoneTier): StreakData {
  const milestones = streak.milestones ?? [];
  if (milestones.includes(tier)) return streak;
  return { ...streak, milestones: [...milestones, tier].sort((a, b) => a - b) };
}
