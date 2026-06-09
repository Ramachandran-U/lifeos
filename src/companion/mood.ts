import type { MoodInputs, MoodResult } from './types';

/**
 * deriveMood (R3) — pure, total, clock-free. All facts are injected; the
 * adapter (useCompanionStore.recompute) gathers them from the real stores.
 *
 * Copy rules (guarded by the denylist test): every reason is forward-framed
 * and guilt-free. The companion never says "you abandoned me", never counts
 * what was lost, never threatens. `resting` is the floor — away time is the
 * companion napping, not deteriorating.
 *
 * Priority (first match wins):
 *   1. resting    — user has been away ≥3 days; the companion slept too
 *   2. concerned  — a streak needs one action today, or a domain went quiet
 *                   (gentle, actionable — never alarmed)
 *   3. thriving   — strong day or strong streak momentum
 *   4. curious    — something is waiting (unopened chest)
 *   5. content    — the default warm baseline
 */

export const RESTING_AFTER_DAYS = 3;
export const THRIVING_COMPLETION_PCT = 0.8;
export const THRIVING_STREAK = 7;

export function deriveMood(inputs: MoodInputs): MoodResult {
  if (inputs.daysSinceLastOpen >= RESTING_AFTER_DAYS) {
    return {
      mood: 'resting',
      reason: 'Took a nice long nap while you were busy. Ready when you are.',
    };
  }

  if (inputs.streakAtRisk) {
    return {
      mood: 'concerned',
      reason: 'One small action today keeps your streak building. Plenty of time.',
    };
  }

  if (inputs.stagnantDomain) {
    return {
      mood: 'concerned',
      reason: 'One part of your life has been quiet lately — a tiny step there would feel good.',
    };
  }

  if (
    inputs.todayCompletionPct >= THRIVING_COMPLETION_PCT ||
    (inputs.bestActiveStreak >= THRIVING_STREAK && inputs.todayCompletionPct >= 0.5)
  ) {
    return {
      mood: 'thriving',
      reason: 'Today is going beautifully. So proud of you.',
    };
  }

  if (inputs.unclaimedChests > 0) {
    return {
      mood: 'curious',
      reason: 'Something shiny is waiting on your Rewards tab…',
    };
  }

  return {
    mood: 'content',
    reason: 'All calm here. Happy to see you.',
  };
}
