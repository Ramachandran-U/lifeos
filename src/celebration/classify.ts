import type { CelebrationInput, CelebrationTier } from './types';

/**
 * The single choke point that decides how big a celebration is. Every caller
 * goes through here — no call site picks its own tier, so "moments only"
 * (and the inflation it prevents) is enforced in exactly one testable place.
 *
 * XP thresholds: a routine block is ~10 XP (micro — the chip burst is enough),
 * a claimed quest is ~25-40 (standard), a milestone bonus or chest jackpot is
 * 50+ (epic). Identity moments (milestone / level-up / day-complete) are
 * always epic — they're the beats users remember.
 */
export const XP_STANDARD_THRESHOLD = 25;
export const XP_EPIC_THRESHOLD = 50;

export function classifyTier(input: CelebrationInput): CelebrationTier {
  switch (input.kind) {
    case 'xp': {
      const amount = input.amount ?? 0;
      if (amount >= XP_EPIC_THRESHOLD) return 'epic';
      if (amount >= XP_STANDARD_THRESHOLD) return 'standard';
      return 'micro';
    }
    case 'streak':
      // The day-to-day +1 flame. The milestone kind covers the big tiers.
      return 'standard';
    case 'badge':
      return 'standard';
    case 'levelUp':
    case 'dayComplete':
    case 'milestone':
      return 'epic';
  }
}
