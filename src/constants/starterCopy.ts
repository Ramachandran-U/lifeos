/**
 * Cold-start starter copy (cold_start_v1) — the single source of truth.
 *
 * Every string introduced by the cold-start spec (docs/design-deep-dive/
 * 02-cold-start.md §3.1) lives HERE and only here. Components import from this
 * object; no starter string is ever written inline in a component. Changing a
 * string is a spec change, not an implementation detail.
 *
 * Compassion rules (machine-checked in __tests__/starterCopy.test.ts):
 * no value contains the substrings `yet`, `still`, `only`, `haven't`, `don't`,
 * or begins with `No `; none contains a standalone `0`; none begins with a
 * digit; every value is ≤ 120 characters.
 *
 * Platform-free on purpose (no react-native imports) so the quest engine and
 * the pure-Node jest harness can import it.
 */

export const STARTER_COPY = {
  /** Rewards hero micro line while `totalXP === 0` (§3.2) — matches XP_VALUES.completeBlock. */
  rewardsHeroMicro: 'Your first block is worth your first 10 XP.',
  /** FirstWinCard headline (§3.2). */
  firstWinHeadline: 'Complete one block on Today.',
  /** FirstWinCard body — gamification pref `full` / `minimal` (§3.2). */
  firstWinBody:
    "That's the whole job for day one. Your XP, badges and streaks all start from that single tap.",
  /** FirstWinCard body — gamification pref `off` (§3.2). */
  firstWinBodyOff: "That's the whole job for day one. Tomorrow's plan builds on it.",
  /** FirstWinCard CTA (§3.2). */
  firstWinCta: 'Go to Today',
  /** Day-1 pinned quest title (§3.3) — 33 chars, inside QuestCard's ≤48 limit. */
  firstQuestTitle: 'Complete your first routine block',
  /** Profile USAGE card starter line (§3.4). */
  profileUsage: 'Your stats begin with your first completed block on Today.',
  /** Rewards BEST STREAK StatBox starter value at bestStreak === 0 (§3.5). */
  bestStreakStarter: 'starts today',
  /** StreakRow zero-state lines (§3.5). */
  streakWorkout: 'Starts with your first workout.',
  streakLearning: 'Starts with your first learning session.',
  streakFoodTracking: 'Starts with your first logged meal.',
  streakJournaling: 'Starts with your first evening reflection.',
  streakSocial: 'Starts with your first reach-out.',
  /** FreezeBank zero-state title (§3.5). */
  freezeForming: 'Your first shield is forming.',
  /** FreezeBank zero-state sub-line tail — composed as `${xpToGo} ${tail}` (§3.5). */
  freezeFormingSub:
    'XP to go. Shields auto-cover a missed day, so a streak bends instead of breaking.',
  /** Explore THIS WEEK card starter at totalMinutesWeek === 0 (§3.6). */
  exploreWeek:
    'Minutes you spend chasing curiosity add up here. Save a spark to start counting.',
  /** Health STREAKS card both-zero starter (§3.6). */
  healthStreaks: 'Streaks start with your first workout or logged meal.',
  /** Health single-zero column fragments (§3.6). */
  healthFirstWorkout: 'first workout',
  healthFirstMeal: 'first logged meal',
  /** Today header XP caption at totalXP === 0, `full` branch (§3.1 table). */
  todayXpBar: 'Your first block fills this bar.',
  /** Zero-state radar meaning caption (§3.7). */
  radarMeaning:
    'Your life in six directions. It starts small on purpose — every block you finish pulls the shape outward.',
} as const;

export type StarterCopyKey = keyof typeof STARTER_COPY;
