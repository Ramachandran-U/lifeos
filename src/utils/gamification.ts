import { differenceInDays, parseISO, format } from 'date-fns';

export interface StreakData {
  count: number;
  lastDate: string;
  graceUsed: boolean;
}

export interface DomainScores {
  goals: number;
  health: number;
  finance: number;
  career: number;
  social: number;
  mind: number;
}

export type BadgeId =
  | 'first_blueprint'
  | 'first_blood_report'
  | 'streak_30_any'
  | 'skill_mastery'
  | 'life_balance'
  | 'goal_complete'
  | 'week_1'
  | 'food_photo';

export interface Streaks {
  workout: StreakData;
  learning: StreakData;
  foodTracking: StreakData;
  journaling: StreakData;
  social: StreakData;
}

export function updateStreak(streak: StreakData): StreakData {
  const today = format(new Date(), 'yyyy-MM-dd');
  const lastDate = streak.lastDate;

  if (!lastDate) {
    return { count: 1, lastDate: today, graceUsed: false };
  }

  const daysDiff = differenceInDays(parseISO(today), parseISO(lastDate));

  if (daysDiff === 0) return streak;
  if (daysDiff === 1) return { count: streak.count + 1, lastDate: today, graceUsed: false };
  if (daysDiff === 2 && !streak.graceUsed) {
    return { count: streak.count, lastDate: today, graceUsed: true };
  }
  return { count: 1, lastDate: today, graceUsed: false };
}

export function calculateDomainScore(
  completedToday: number,
  totalToday: number,
  currentScore: number,
): number {
  if (totalToday === 0) return currentScore;
  const dailyScore = (completedToday / totalToday) * 100;
  // Rolling average with current score (weighted 70% history, 30% today)
  const newScore = Math.round(currentScore * 0.7 + dailyScore * 0.3);
  return Math.min(100, Math.max(0, newScore));
}

export function checkBadges(
  currentBadges: BadgeId[],
  context: {
    domainScores?: DomainScores;
    streaks?: Streaks;
    completedGoal?: boolean;
    completedBloodReport?: boolean;
    completedSkillMastery?: boolean;
    onboardingComplete?: boolean;
    consecutiveDays?: number;
    usedFoodPhoto?: boolean;
  },
): BadgeId[] {
  const newBadges: BadgeId[] = [];

  if (context.onboardingComplete && !currentBadges.includes('first_blueprint')) {
    newBadges.push('first_blueprint');
  }

  if (context.completedBloodReport && !currentBadges.includes('first_blood_report')) {
    newBadges.push('first_blood_report');
  }

  if (context.completedGoal && !currentBadges.includes('goal_complete')) {
    newBadges.push('goal_complete');
  }

  if (context.completedSkillMastery && !currentBadges.includes('skill_mastery')) {
    newBadges.push('skill_mastery');
  }

  if (context.streaks) {
    const anyStreak30 = Object.values(context.streaks).some((s) => s.count >= 30);
    if (anyStreak30 && !currentBadges.includes('streak_30_any')) {
      newBadges.push('streak_30_any');
    }
  }

  if (context.domainScores) {
    const allAbove60 = Object.values(context.domainScores).every((s) => s > 60);
    if (allAbove60 && !currentBadges.includes('life_balance')) {
      newBadges.push('life_balance');
    }
  }

  if (context.consecutiveDays && context.consecutiveDays >= 7 && !currentBadges.includes('week_1')) {
    newBadges.push('week_1');
  }

  if (context.usedFoodPhoto && !currentBadges.includes('food_photo')) {
    newBadges.push('food_photo');
  }

  return newBadges;
}

/**
 * Cumulative XP milestone shown on the level ladder for tier `n`
 * (triangular progression: 100, 300, 600, …).
 */
export function xpForLevel(n: number): number {
  return (100 * n * (n + 1)) / 2;
}

/** Minimum total XP at which level `level` (1-indexed) begins. Level 1 starts at 0. */
export function xpTotalAtStartOfLevel(level: number): number {
  if (level <= 1) return 0;
  return (100 * level * (level + 1)) / 2;
}

export function levelFromXP(xp: number): number {
  let n = 1;
  while (xpTotalAtStartOfLevel(n + 1) <= xp) n += 1;
  return n;
}

export interface LevelProgress {
  level: number;
  current: number;
  needed: number;
  pct: number;
}

export function xpProgressInLevel(xp: number): LevelProgress {
  const level = levelFromXP(xp);
  const start = xpTotalAtStartOfLevel(level);
  const end = xpTotalAtStartOfLevel(level + 1);
  const needed = end - start;
  const current = xp - start;
  const pct = needed > 0 ? Math.min(1, Math.max(0, current / needed)) : 1;
  return { level, current, needed, pct };
}

export const XP_VALUES = {
  completeBlock: 10,
  completeGoalTask: 15,
  logFood: 5,
  logWeight: 10,
  uploadBloodReport: 50,
  completeResource: 100,
  earnBadge: 200,
  photoFood: 20,
} as const;

// Ladder labels use `xpForLevel`; progress bars use `xpTotalAtStartOfLevel` (see above).

// ─── Level perks (design mock — surface on Rewards ladder) ───────────────────
export const LEVEL_PERKS: Record<number, string[]> = {
  8:  ['Finance Insights', 'Custom Avatar Frame', '+5% XP Boost'],
  9:  ['Advanced Goal Templates', 'Weekly Report PDF', 'Streak Shield (1/mo)'],
  10: ['AI Coach Mode', 'Priority Briefings', '+10% XP Boost'],
  11: ['LifeOS Premium Badge', 'All Modules Unlocked', 'Founder Status'],
  12: ['Mentor Mode', 'Custom Themes', 'API Access'],
};

// ─── Badge metadata (surfacing in Rewards gallery) ───────────────────────────
export const BADGE_META: Record<BadgeId, { label: string; emoji: string; desc: string }> = {
  first_blueprint:    { label: 'First Blueprint',   emoji: '📋', desc: 'Completed onboarding & built your first routine' },
  first_blood_report: { label: 'Health Report',     emoji: '🩸', desc: 'Uploaded your first health data report' },
  streak_30_any:      { label: '30-Day Streak',     emoji: '🔥', desc: 'Maintained any habit streak for 30 consecutive days' },
  skill_mastery:      { label: 'Skill Master',      emoji: '🧠', desc: 'Completed a full learning resource or course' },
  life_balance:       { label: 'Life Balance',      emoji: '⚖️', desc: 'All 6 domain scores above 60 simultaneously' },
  goal_complete:      { label: 'Goal Crusher',      emoji: '🏆', desc: 'Completed your first major goal milestone' },
  week_1:             { label: 'Week One',          emoji: '📅', desc: 'Opened LifeOS for 7 consecutive days' },
  food_photo:         { label: 'Food Photographer', emoji: '📸', desc: 'Logged a meal using the camera feature' },
};

// ─── Streak metadata ─────────────────────────────────────────────────────────
export type StreakKey = keyof Streaks;

export const STREAK_META: Record<StreakKey, { label: string; emoji: string; colorKey: string }> = {
  workout:      { label: 'Workout',    emoji: '💪', colorKey: 'health'   },
  learning:     { label: 'Learning',   emoji: '📚', colorKey: 'polymath' },
  foodTracking: { label: 'Food Log',   emoji: '🥗', colorKey: 'health'   },
  journaling:   { label: 'Journaling', emoji: '✍️', colorKey: 'goal'     },
  social:       { label: 'Social',     emoji: '🤝', colorKey: 'social'   },
};

// ─── Domain metadata (hex radar layout) ──────────────────────────────────────
// Angles match design: clockwise from top, 60° apart.
export type DomainKey = keyof DomainScores;

export const DOMAIN_META: { key: DomainKey; label: string; emoji: string; colorKey: string; angle: number }[] = [
  { key: 'goals',   label: 'Goals',   emoji: '🎯', colorKey: 'goal',     angle: -90  },
  { key: 'health',  label: 'Health',  emoji: '💚', colorKey: 'health',   angle: -30  },
  { key: 'finance', label: 'Finance', emoji: '💰', colorKey: 'finance',  angle: 30   },
  { key: 'career',  label: 'Career',  emoji: '🚀', colorKey: 'career',   angle: 90   },
  { key: 'social',  label: 'Social',  emoji: '🤝', colorKey: 'social',   angle: 150  },
  { key: 'mind',    label: 'Mind',    emoji: '🔭', colorKey: 'polymath', angle: -150 },
];

// ─── Module metadata (used by QuestCard + RoutineBlock) ──────────────────────
export const MODULE_META: Record<string, { label: string; emoji: string; colorKey: string }> = {
  goal:     { label: 'Goals',   emoji: '🎯', colorKey: 'goal'     },
  health:   { label: 'Health',  emoji: '💚', colorKey: 'health'   },
  finance:  { label: 'Finance', emoji: '💰', colorKey: 'finance'  },
  career:   { label: 'Career',  emoji: '🚀', colorKey: 'career'   },
  social:   { label: 'Social',  emoji: '🤝', colorKey: 'social'   },
  polymath: { label: 'Explore', emoji: '🔭', colorKey: 'polymath' },
};

// ─── Quests ──────────────────────────────────────────────────────────────────
export type QuestType = 'daily' | 'weekly';

export interface Quest {
  id: string;
  title: string;
  module: string;       // keys into MODULE_META
  xp: number;
  progress: number;
  total: number;
  type: QuestType;
}

// Seed quests so the UI has something meaningful to render before the quest
// generator is wired into routine/goal events.
export const DEFAULT_QUESTS: Quest[] = [
  { id: 'q1', title: 'Log 3 meals today',         module: 'health',   xp: 30,  progress: 0, total: 3, type: 'daily'  },
  { id: 'q2', title: 'Complete morning routine',  module: 'goal',     xp: 50,  progress: 0, total: 5, type: 'daily'  },
  { id: 'q3', title: 'Finish a learning resource',module: 'polymath', xp: 100, progress: 0, total: 1, type: 'weekly' },
];
