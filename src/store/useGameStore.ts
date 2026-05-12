import { create } from 'zustand';
import { getOrCreateGamification, updateGamification } from '@/db/queries/gamification';
import {
  DomainScores,
  Streaks,
  BadgeId,
  updateStreak,
  calculateDomainScore,
  checkBadges,
  XP_VALUES,
  levelFromXP,
} from '@/utils/gamification';
import { DEFAULT_QUESTS, type Quest } from '@/constants/gamification';

interface GameState {
  domainScores: DomainScores;
  streaks: Streaks;
  badges: BadgeId[];
  totalXP: number;
  weeklyXP: number;
  pendingBadges: BadgeId[];
  quests: Quest[];
  pendingLevelUp: number | null;
  lastKnownLevel: number;

  loadFromDB: (userId: string) => void;
  completeBlock: (userId: string, module: string, completedCount: number, totalCount: number) => void;
  addXP: (userId: string, amount: number) => void;
  triggerStreak: (userId: string, streakType: keyof Streaks) => void;
  awardBadge: (userId: string, badgeId: BadgeId) => void;
  popBadge: () => BadgeId | undefined;
  advanceQuest: (id: string, delta?: number) => void;
  dismissLevelUp: () => void;
}

const DEFAULT_STREAKS: Streaks = {
  workout: { count: 0, lastDate: '', graceUsed: false },
  learning: { count: 0, lastDate: '', graceUsed: false },
  foodTracking: { count: 0, lastDate: '', graceUsed: false },
  journaling: { count: 0, lastDate: '', graceUsed: false },
  social: { count: 0, lastDate: '', graceUsed: false },
};

const DEFAULT_SCORES: DomainScores = {
  goals: 15, health: 15, finance: 15, career: 15, social: 15, mind: 15,
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
  quests: DEFAULT_QUESTS.map((q) => ({ ...q })),
  pendingLevelUp: null,
  lastKnownLevel: 1,

  loadFromDB: (userId) => {
    const game = getOrCreateGamification(userId);
    let scores = DEFAULT_SCORES;
    let streaks = DEFAULT_STREAKS;
    let badges: BadgeId[] = [];
    try {
      const parsed = JSON.parse(game.domainScores) as DomainScores;
      scores = {
        goals: Math.max(15, parsed.goals ?? 0),
        health: Math.max(15, parsed.health ?? 0),
        finance: Math.max(15, parsed.finance ?? 0),
        career: Math.max(15, parsed.career ?? 0),
        social: Math.max(15, parsed.social ?? 0),
        mind: Math.max(15, parsed.mind ?? 0),
      };
    } catch { /* keep default */ }
    try { streaks = JSON.parse(game.streaks); } catch { /* keep default */ }
    try { badges = JSON.parse(game.badges); } catch { /* keep default */ }

    set({
      domainScores: scores,
      streaks,
      badges,
      totalXP: game.totalXP,
      weeklyXP: game.weeklyXP,
      lastKnownLevel: levelFromXP(game.totalXP),
    });
  },

  completeBlock: (userId, module, completedCount, totalCount) => {
    const { domainScores, badges, streaks, totalXP, weeklyXP } = get();
    const domain = MODULE_TO_DOMAIN[module];
    if (!domain) return;

    const newScores = { ...domainScores };
    newScores[domain] = calculateDomainScore(completedCount, totalCount, newScores[domain]);

    const newXP = totalXP + XP_VALUES.completeBlock;
    const newWeeklyXP = weeklyXP + XP_VALUES.completeBlock;

    const newBadges = checkBadges(badges, { domainScores: newScores, streaks });
    const allBadges = [...badges, ...newBadges];

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
    });
  },

  addXP: (userId, amount) => {
    const { totalXP, weeklyXP, lastKnownLevel } = get();
    const newTotal = totalXP + amount;
    const newWeekly = weeklyXP + amount;
    const newLevel = levelFromXP(newTotal);
    updateGamification(userId, { totalXP: newTotal, weeklyXP: newWeekly });
    set({
      totalXP: newTotal,
      weeklyXP: newWeekly,
      lastKnownLevel: newLevel,
      pendingLevelUp: newLevel > lastKnownLevel ? newLevel : get().pendingLevelUp,
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

  advanceQuest: (id, delta = 1) => {
    const { quests } = get();
    set({
      quests: quests.map((q) =>
        q.id === id ? { ...q, progress: Math.min(q.total, q.progress + delta) } : q,
      ),
    });
  },

  dismissLevelUp: () => set({ pendingLevelUp: null }),
}));
