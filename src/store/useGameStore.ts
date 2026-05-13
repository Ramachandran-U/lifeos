import { create } from 'zustand';
import { getOrCreateGamification, updateGamification } from '@/db/queries/gamification';
import {
  DomainScores,
  Streaks,
  BadgeId,
  Quest,
  DEFAULT_QUESTS,
  updateStreak,
  calculateDomainScore,
  checkBadges,
  levelFromXP,
  XP_VALUES,
} from '@/utils/gamification';

interface GameState {
  domainScores: DomainScores;
  streaks: Streaks;
  badges: BadgeId[];
  totalXP: number;
  weeklyXP: number;
  pendingBadges: BadgeId[];
  pendingLevelUps: number[];
  quests: Quest[];

  loadFromDB: (userId: string) => void;
  completeBlock: (userId: string, module: string, completedCount: number, totalCount: number) => void;
  addXP: (userId: string, amount: number) => void;
  triggerStreak: (userId: string, streakType: keyof Streaks) => void;
  awardBadge: (userId: string, badgeId: BadgeId) => void;
  popBadge: () => BadgeId | undefined;
  popLevelUp: () => number | undefined;
  updateQuestProgress: (id: string, progress: number) => void;
}

const DEFAULT_STREAKS: Streaks = {
  workout: { count: 0, lastDate: '', graceUsed: false },
  learning: { count: 0, lastDate: '', graceUsed: false },
  foodTracking: { count: 0, lastDate: '', graceUsed: false },
  journaling: { count: 0, lastDate: '', graceUsed: false },
  social: { count: 0, lastDate: '', graceUsed: false },
};

const DEFAULT_SCORES: DomainScores = {
  goals: 0, health: 0, finance: 0, career: 0, social: 0, mind: 0,
};

const MODULE_TO_DOMAIN: Record<string, keyof DomainScores> = {
  goal: 'goals',
  health: 'health',
  finance: 'finance',
  career: 'career',
  social: 'social',
  polymath: 'mind',
};

export const useGameStore = create<GameState>((set, get) => ({
  domainScores: { ...DEFAULT_SCORES },
  streaks: { ...DEFAULT_STREAKS },
  badges: [],
  totalXP: 0,
  weeklyXP: 0,
  pendingBadges: [],
  pendingLevelUps: [],
  quests: DEFAULT_QUESTS.map((q) => ({ ...q })),

  loadFromDB: (userId) => {
    const game = getOrCreateGamification(userId);
    let scores = DEFAULT_SCORES;
    let streaks = DEFAULT_STREAKS;
    let badges: BadgeId[] = [];
    try { scores = JSON.parse(game.domainScores); } catch { /* keep default */ }
    try { streaks = JSON.parse(game.streaks); } catch { /* keep default */ }
    try { badges = JSON.parse(game.badges); } catch { /* keep default */ }

    set({
      domainScores: scores,
      streaks,
      badges,
      totalXP: game.totalXP,
      weeklyXP: game.weeklyXP,
    });
  },

  completeBlock: (userId, module, completedCount, totalCount) => {
    const { domainScores, badges, streaks, totalXP, weeklyXP, pendingLevelUps } = get();
    const domain = MODULE_TO_DOMAIN[module];
    if (!domain) return;

    const newScores = { ...domainScores };
    newScores[domain] = calculateDomainScore(completedCount, totalCount, newScores[domain]);

    const newXP = totalXP + XP_VALUES.completeBlock;
    const newWeeklyXP = weeklyXP + XP_VALUES.completeBlock;

    const newBadges = checkBadges(badges, { domainScores: newScores, streaks });
    const allBadges = [...badges, ...newBadges];

    // Detect level crossings from old→new total XP
    const oldLevel = levelFromXP(totalXP);
    const newLevel = levelFromXP(newXP);
    const crossed: number[] = [];
    for (let l = oldLevel + 1; l <= newLevel; l++) crossed.push(l);

    updateGamification(userId, {
      domainScores: JSON.stringify(newScores),
      badges: JSON.stringify(allBadges),
      totalXP: newXP,
      weeklyXP: newWeeklyXP,
    });

    set({
      domainScores: newScores,
      badges: allBadges,
      totalXP: newXP,
      weeklyXP: newWeeklyXP,
      pendingBadges: [...get().pendingBadges, ...newBadges],
      pendingLevelUps: [...pendingLevelUps, ...crossed],
    });
  },

  addXP: (userId, amount) => {
    const { totalXP, weeklyXP, pendingLevelUps } = get();
    const newTotal = totalXP + amount;
    const newWeekly = weeklyXP + amount;

    const oldLevel = levelFromXP(totalXP);
    const newLevel = levelFromXP(newTotal);
    const crossed: number[] = [];
    for (let l = oldLevel + 1; l <= newLevel; l++) crossed.push(l);

    updateGamification(userId, { totalXP: newTotal, weeklyXP: newWeekly });
    set({
      totalXP: newTotal,
      weeklyXP: newWeekly,
      pendingLevelUps: [...pendingLevelUps, ...crossed],
    });
  },

  triggerStreak: (userId, streakType) => {
    const { streaks, badges } = get();
    const updated = { ...streaks };
    updated[streakType] = updateStreak(updated[streakType]);

    const newBadges = checkBadges(badges, { streaks: updated });
    const allBadges = [...badges, ...newBadges];

    updateGamification(userId, {
      streaks: JSON.stringify(updated),
      badges: JSON.stringify(allBadges),
    });

    set({
      streaks: updated,
      badges: allBadges,
      pendingBadges: [...get().pendingBadges, ...newBadges],
    });
  },

  awardBadge: (userId, badgeId) => {
    const { badges } = get();
    if (badges.includes(badgeId)) return;

    const newBadges = [...badges, badgeId];
    updateGamification(userId, { badges: JSON.stringify(newBadges) });
    set({
      badges: newBadges,
      pendingBadges: [...get().pendingBadges, badgeId],
    });
  },

  popBadge: () => {
    const { pendingBadges } = get();
    if (pendingBadges.length === 0) return undefined;
    const [first, ...rest] = pendingBadges;
    set({ pendingBadges: rest });
    return first;
  },

  popLevelUp: () => {
    const { pendingLevelUps } = get();
    if (pendingLevelUps.length === 0) return undefined;
    const [first, ...rest] = pendingLevelUps;
    set({ pendingLevelUps: rest });
    return first;
  },

  updateQuestProgress: (id, progress) => {
    set({
      quests: get().quests.map((q) =>
        q.id === id ? { ...q, progress: Math.min(progress, q.total) } : q,
      ),
    });
  },
}));
