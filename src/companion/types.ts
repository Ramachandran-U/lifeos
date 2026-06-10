/**
 * Companion product model (R3, flag: companion_v1).
 *
 * COMPASSION CONSTRAINT, ENFORCED BY THIS TYPE: the mood floor is `resting`.
 * There is no sick / dying / sad / abandoned state and there never will be —
 * a companion that suffers when the user steps away is emotional blackmail
 * (the Tamagotchi failure mode), and the whole point of this layer is warmth
 * without obligation. Away time reads as the companion *resting*, nothing
 * worse. Adding a negative state requires changing this closed union, which
 * is exactly the review speed-bump it is designed to be — and the guilt-
 * phrase denylist test on mood copy backs it up.
 */
export type CompanionMood = 'thriving' | 'content' | 'curious' | 'concerned' | 'resting';

export const COMPANION_MOODS: readonly CompanionMood[] = [
  'thriving',
  'content',
  'curious',
  'concerned',
  'resting',
] as const;

/** Everything deriveMood looks at — injected, so the core stays pure. */
export interface MoodInputs {
  /** Highest count among currently-active streaks. */
  bestActiveStreak: number;
  /** detectStreakAtRisk (src/cognition/streakAtRisk) returned a candidate. */
  streakAtRisk: boolean;
  /** Today's routine completion, 0..1. */
  todayCompletionPct: number;
  /** Whole days since the app was last opened (0 = opened today). */
  daysSinceLastOpen: number;
  /** A domain-stagnation insight is currently live. */
  stagnantDomain: boolean;
  /** Pending (unopened) chests. */
  unclaimedChests: number;
}

export interface MoodResult {
  mood: CompanionMood;
  /** Plain-words, guilt-free explanation shown in the CompanionSheet. */
  reason: string;
}

/** Persisted companion identity — lives in the gamification `companion` JSON
 *  column (LWW-merged across devices). Mood is DERIVED, never persisted. */
export interface CompanionIdentity {
  name: string;
  createdAt: string;
  /** Equipped cosmetic ids, at most one per slot (see constants/cosmetics). */
  equipped: string[];
}
