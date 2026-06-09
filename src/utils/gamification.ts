import { differenceInDays, parseISO, format } from 'date-fns';

export interface StreakData {
  count: number;
  lastDate: string;
  graceUsed: boolean;
  // streak_protection_v1 — optional so '{}'-era rows parse unchanged; the
  // engine (src/gamification/streakEngine.ts) defaults them on read.
  /** High-water mark across all runs of this streak. */
  best?: number;
  /** Milestone tiers already celebrated (e.g. [7, 30]) — dedupes overlays. */
  milestones?: number[];
  /** Set on a genuine reset; enables the 24h recovery restore. */
  lastLoss?: { count: number; date: string } | null;
}

export interface DomainScores {
  goals: number;
  health: number;
  finance: number;
  career: number;
  social: number;
  // Canonical name for the 6th domain is now `polymath` (matches the module
  // key, DomainId, and color/glyph tokens). Legacy persisted data used `mind`;
  // load paths coalesce mind→polymath. (BUG-009)
  polymath: number;
}

export type BadgeId =
  | 'first_blueprint'
  | 'first_blood_report'
  | 'streak_30_any'
  | 'skill_mastery'
  | 'life_balance'
  | 'goal_complete'
  | 'week_1'
  | 'food_photo'
  | 'first_connection'
  | 'inner_orbit'
  | 'polymath_starter'
  | 'expedition_complete'
  | 'synapse_formed'
  | 'curiosity_streak_7'
  // Rabbit-hole tree-map (Explore v3)
  | 'deep_diver'
  | 'cartographer'
  | 'road_not_taken'
  | 'connector'
  | 'archivist';

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
    /** Inner-circle contacts: count of inner-circle contacts and how many are in cadence. */
    innerCircle?: { total: number; inCadence: number };
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

  if (
    context.innerCircle &&
    context.innerCircle.total > 0 &&
    context.innerCircle.inCadence === context.innerCircle.total &&
    !currentBadges.includes('inner_orbit')
  ) {
    newBadges.push('inner_orbit');
  }

  return newBadges;
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
  sparkSaved: 10,
  expeditionStepComplete: 20,
  expeditionComplete: 100,
  synapseFormed: 50,
} as const;

/**
 * Polymath score: rewards both depth (deep-dive hours) AND breadth (distinct
 * categories touched). The polymath tension — go deep AND range wide — is the
 * game. Range 0-100; used for the polymath domain score.
 */
export function polymathScore(depth: number, breadth: number): number {
  const d = Math.min(depth / 12, 1); // 12 salience-points = full depth (4 deep-dives)
  const b = Math.min(breadth / 5, 1); // 5 categories = full breadth
  return Math.round((d * 0.5 + b * 0.5) * 100);
}

// ─── Level progression ───────────────────────────────────────────────────────
// Cumulative XP required to reach level n: 100 * n * (n + 1) / 2
// e.g. L1=100, L2=300, L3=600, L4=1000, L5=1500, L6=2100, L7=2800, L8=3600,
//      L9=4500, L10=5500, L11=6600, L12=7800

export function xpForLevel(n: number): number {
  return (100 * n * (n + 1)) / 2;
}

export function levelFromXP(xp: number): number {
  let n = 1;
  while (xpForLevel(n + 1) <= xp) n++;
  return n;
}

export interface LevelProgress {
  level: number;
  current: number; // XP accumulated inside the current level
  needed: number;  // XP required to advance to the next level
  pct: number;     // 0..1
}

export function xpProgressInLevel(xp: number): LevelProgress {
  const level = levelFromXP(xp);
  // levelFromXP returns 1 even when xp < xpForLevel(2). Anchor the "start of
  // current level" at xpForLevel(level-1) — or 0 for level 1 — so users with
  // little XP see 0/N progress instead of a negative current.
  const start = level <= 1 ? 0 : xpForLevel(level);
  const end = level <= 1 ? xpForLevel(2) : xpForLevel(level + 1);
  const needed = end - start;
  const current = Math.max(0, xp - start);
  const pct = Math.min(1, Math.max(0, current / needed));
  return { level, current, needed, pct };
}

/**
 * A warm, behavioural identity for the user's current level — a *description of
 * their stage*, never a rank others climb past (per the game-design review).
 * Surfaced on the Rewards hero as the "proud mirror".
 */
export function levelTitle(level: number): string {
  if (level <= 1) return 'Getting Started';
  if (level <= 2) return 'Finding Your Footing';
  if (level <= 4) return 'Building Momentum';
  if (level <= 6) return 'In the Groove';
  if (level <= 8) return 'Consistency Pro';
  if (level <= 10) return 'Life Architect';
  return 'Master Builder';
}

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
  first_connection:   { label: 'First Connection',  emoji: '🤝', desc: 'Added your first contact to Social Hub' },
  inner_orbit:        { label: 'Inner Orbit',       emoji: '🪐', desc: 'All inner-circle contacts inside cadence' },
  polymath_starter:   { label: 'Polymath Starter',  emoji: '🔭', desc: 'Logged time on a deep-dive interest' },
  expedition_complete:{ label: 'Expeditioner',     emoji: '🧭', desc: 'Completed your first expedition' },
  synapse_formed:     { label: 'Synapse',          emoji: '⚡', desc: 'Formed a cross-discipline link in your constellation' },
  curiosity_streak_7: { label: 'Curious Week',     emoji: '🌟', desc: 'Engaged with a spark for 7 consecutive days' },
  deep_diver:         { label: 'Deep Diver',       emoji: '🕳️', desc: 'Went five levels deep down a single rabbit hole' },
  cartographer:       { label: 'Cartographer',     emoji: '🗺️', desc: 'Mapped three branches of one rabbit hole' },
  road_not_taken:     { label: 'The Road Not Taken', emoji: '🛤️', desc: 'Returned to a fork and explored the other path' },
  connector:          { label: 'Connector',        emoji: '🔗', desc: 'Linked two different fields in a rabbit hole' },
  archivist:          { label: 'Archivist',        emoji: '📚', desc: 'Built a library of five rich rabbit-hole maps' },
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
  { key: 'polymath', label: 'Mind',   emoji: '🔭', colorKey: 'polymath', angle: -150 },
];

// ─── Goal completion → domain scoring ────────────────────────────────────────
// Completing a goal node should move the life/domain score (it never did before
// — goal status was a dead-end flip). Map the goal's `goalType` onto a domain
// score key, and weight the bump by how big the completed node is.
export const GOALTYPE_TO_DOMAIN: Record<string, DomainKey> = {
  career: 'career',
  health: 'health',
  finance: 'finance',
  learning: 'polymath',
  social: 'social',
  personal: 'goals',
};

// How many points completing a node of each level adds to its domain. A daily
// task is a nudge; finishing the whole life goal is a celebration.
export const GOAL_LEVEL_BUMP: Record<string, number> = {
  daily: 3,
  weekly: 5,
  monthly: 8,
  yearly: 12,
  life: 20,
};

/** Clamp a domain score to 0..100 after applying a delta. */
export function bumpDomainScore(current: number, delta: number): number {
  return Math.min(100, Math.max(0, Math.round(current + delta)));
}

// Map a goal's `goalType` to the routine-block `module` it belongs in, so a
// focus block created from a goal is colour/scored under the right domain.
export const GOALTYPE_TO_MODULE: Record<string, string> = {
  career: 'career',
  health: 'health',
  finance: 'finance',
  learning: 'polymath',
  social: 'social',
  personal: 'goal',
};

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
