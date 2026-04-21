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

export function xpForLevel(n: number): number {
  return (100 * n * (n + 1)) / 2;
}

export function levelFromXP(xp: number): number {
  let n = 1;
  while (xpForLevel(n + 1) <= xp) n++;
  return n;
}

export function xpProgressInLevel(xp: number): {
  level: number;
  current: number;
  needed: number;
  pct: number;
} {
  const level = levelFromXP(xp);
  const start = xpForLevel(level);
  const end = xpForLevel(level + 1);
  const pct = Math.min(1, (xp - start) / (end - start));
  return { level, current: xp - start, needed: end - start, pct };
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
