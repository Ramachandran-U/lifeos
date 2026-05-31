import { create } from 'zustand';
import { Platform } from 'react-native';
import { getOrCreateGamification, updateGamification } from '@/db/queries/gamification';
import { getUser } from '@/db/queries/users';
import { ONBOARDING_COMPLETE } from './useUserStore';
import {
  DomainScores,
  Streaks,
  BadgeId,
  updateStreak,
  calculateDomainScore,
  checkBadges,
  XP_VALUES,
  levelFromXP,
  GOALTYPE_TO_DOMAIN,
  GOAL_LEVEL_BUMP,
  bumpDomainScore,
} from '@/utils/gamification';
import { DEFAULT_QUESTS, type Quest } from '@/constants/gamification';

// Quest progress is held in zustand memory + persisted to localStorage on web.
// (Native does not need persistence here because the store rehydrates from
// SQLite via loadFromDB; this storage handles the web reload path.)
const QUEST_STORAGE_KEY = 'lifeos_quests_v1';
interface PersistedQuests {
  quests: Quest[];
  questDailyResetDate: string;
}
function loadPersistedQuests(): PersistedQuests | null {
  if (Platform.OS !== 'web') return null;
  try {
    const raw = localStorage.getItem(QUEST_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedQuests;
  } catch {
    return null;
  }
}
function persistQuests(state: PersistedQuests) {
  if (Platform.OS !== 'web') return;
  try {
    localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

interface GameState {
  domainScores: DomainScores;
  streaks: Streaks;
  badges: BadgeId[];
  totalXP: number;
  weeklyXP: number;
  pendingBadges: BadgeId[];
  quests: Quest[];
  questDailyResetDate: string; // YYYY-MM-DD; resets q_food, q_routine on rollover
  pendingLevelUp: number | null;
  lastKnownLevel: number;

  loadFromDB: (userId: string) => void;
  completeBlock: (userId: string, module: string, completedCount: number, totalCount: number) => void;
  completeGoalNode: (userId: string, goalType: string, level: string) => void;
  addXP: (userId: string, amount: number) => void;
  triggerStreak: (userId: string, streakType: keyof Streaks) => void;
  awardBadge: (userId: string, badgeId: BadgeId) => void;
  popBadge: () => BadgeId | undefined;
  advanceQuest: (id: string, delta?: number) => void;
  resetDailyQuestsIfNeeded: () => void;
  dismissLevelUp: () => void;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DEFAULT_STREAKS: Streaks = {
  workout: { count: 0, lastDate: '', graceUsed: false },
  learning: { count: 0, lastDate: '', graceUsed: false },
  foodTracking: { count: 0, lastDate: '', graceUsed: false },
  journaling: { count: 0, lastDate: '', graceUsed: false },
  social: { count: 0, lastDate: '', graceUsed: false },
};

const DEFAULT_SCORES: DomainScores = {
  goals: 15, health: 15, finance: 15, career: 15, social: 15, polymath: 15,
};

const MODULE_TO_DOMAIN: Record<string, keyof DomainScores> = {
  goal: 'goals',
  health: 'health',
  finance: 'finance',
  career: 'career',
  social: 'social',
  polymath: 'polymath',
};

const persistedQuests = loadPersistedQuests();

export const useGameStore = create<GameState>((set, get) => ({
  domainScores: { ...DEFAULT_SCORES },
  streaks: { ...DEFAULT_STREAKS },
  badges: [],
  totalXP: 0,
  weeklyXP: 0,
  pendingBadges: [],
  quests: persistedQuests?.quests ?? DEFAULT_QUESTS.map((q) => ({ ...q })),
  questDailyResetDate: persistedQuests?.questDailyResetDate ?? todayISO(),
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
        // Read-alias: coalesce legacy `mind` into `polymath` so existing
        // gamification rows aren't zeroed by the BUG-009 rename.
        polymath: Math.max(15, parsed.polymath ?? (parsed as { mind?: number }).mind ?? 0),
      };
    } catch { /* keep default */ }
    // Merge OVER the defaults — a fresh user's row stores streaks as '{}',
    // and replacing wholesale would drop every per-type key (workout,
    // learning, …). triggerStreak would then call updateStreak(undefined)
    // and throw on `streak.lastDate`, so the streak never saves. Merging
    // guarantees all five keys are always present.
    try { streaks = { ...DEFAULT_STREAKS, ...JSON.parse(game.streaks) }; } catch { /* keep default */ }
    try { badges = JSON.parse(game.badges); } catch { /* keep default */ }

    // Retroactive first_blueprint award. The badge used to only be granted
    // from day1-routine.tsx; users who finished via welcome-intent or
    // discovery-confirm completed onboarding but never received it. This
    // makes good on the debt on next app open.
    if (!badges.includes('first_blueprint')) {
      try {
        const user = getUser();
        if (user && user.onboardingStage >= ONBOARDING_COMPLETE) {
          badges = [...badges, 'first_blueprint'];
          updateGamification(userId, { badges: JSON.stringify(badges) });
        }
      } catch {
        // getUser is sync over SQLite; on web it could throw if not signed in.
        // Skip the retroactive claim silently — they'll get it via the
        // onboarding-completion paths instead.
      }
    }

    set({
      domainScores: scores,
      streaks,
      badges,
      totalXP: game.totalXP,
      weeklyXP: game.weeklyXP,
      lastKnownLevel: levelFromXP(game.totalXP),
    });

    // Daily quest rollover — runs on every focus / mount.
    get().resetDailyQuestsIfNeeded();

    // Snapshot today's scores into the rolling 7-day history so the
    // Rewards screen's sparkline + delta can render real data. Idempotent
    // within a UTC day. Dynamic import to avoid a circular dep at module
    // load (useDomainHistoryStore doesn't depend on useGameStore, but
    // keeping it lazy is cheaper than reasoning about init order).
    import('./useDomainHistoryStore').then(({ useDomainHistoryStore }) =>
      useDomainHistoryStore.getState().record(scores),
    ).catch(() => { /* non-fatal */ });
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

    // Routine quest — every completed block ticks toward "Complete morning routine".
    get().advanceQuest('q_routine', 1);
  },

  completeGoalNode: (userId, goalType, level) => {
    const { domainScores, badges, totalXP, weeklyXP } = get();
    const domain = GOALTYPE_TO_DOMAIN[goalType] ?? 'goals';
    const delta = GOAL_LEVEL_BUMP[level] ?? GOAL_LEVEL_BUMP.daily;

    const newScores = { ...domainScores };
    newScores[domain] = bumpDomainScore(newScores[domain], delta);

    // A finished daily task is worth a task; a finished milestone is worth more.
    const xpGain = level === 'daily' ? XP_VALUES.completeGoalTask : XP_VALUES.completeGoalTask * 2;
    const newXP = totalXP + xpGain;
    const newWeeklyXP = weeklyXP + xpGain;

    // The 'Goal Crusher' badge fires only when the whole life goal is done.
    const newBadges = checkBadges(badges, {
      domainScores: newScores,
      completedGoal: level === 'life',
    });
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

    // Snapshot the new scores so the Life Score trend/sparkline reflects the
    // completion immediately (mirrors loadFromDB's history record).
    import('./useDomainHistoryStore').then(({ useDomainHistoryStore }) =>
      useDomainHistoryStore.getState().record(newScores),
    ).catch(() => { /* non-fatal */ });
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
    get().resetDailyQuestsIfNeeded();
    const { quests, questDailyResetDate } = get();
    const next = quests.map((q) =>
      q.id === id ? { ...q, progress: Math.min(q.total, q.progress + delta) } : q,
    );
    set({ quests: next });
    persistQuests({ quests: next, questDailyResetDate });
  },

  resetDailyQuestsIfNeeded: () => {
    const today = todayISO();
    const { questDailyResetDate, quests } = get();
    if (questDailyResetDate === today) return;
    const next = quests.map((q) => (q.type === 'daily' ? { ...q, progress: 0 } : q));
    set({ questDailyResetDate: today, quests: next });
    persistQuests({ quests: next, questDailyResetDate: today });
  },

  dismissLevelUp: () => set({ pendingLevelUp: null }),
}));
