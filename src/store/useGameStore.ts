import { create } from 'zustand';
import { Platform } from 'react-native';
import { getOrCreateGamification, updateGamification } from '@/db/queries/gamification';
import { insertXpEvent, localDayISO, type XpGrantInput } from '@/db/queries/xpEvents';
import { getUser } from '@/db/queries/users';
import { ONBOARDING_COMPLETE } from './useUserStore';
import {
  DomainScores,
  Streaks,
  BadgeId,
  calculateDomainScore,
  checkBadges,
  XP_VALUES,
  levelFromXP,
  GOALTYPE_TO_DOMAIN,
  GOAL_LEVEL_BUMP,
  bumpDomainScore,
  STREAK_META,
} from '@/utils/gamification';
import { useRewardQueueStore } from './useRewardQueueStore';
import {
  advanceStreak,
  restoreFromLoss,
  markMilestoneCelebrated,
  accrueFreezeProgress,
  MAX_FREEZES_BANKED,
  type MilestoneTier,
} from '@/gamification/streakEngine';
import { maybeGrantChest } from '@/gamification/chestGrants';
import { useFlagStore } from './useFlagStore';
import { tickQuestMetric } from './useQuestStore';
import { track, EVENTS } from '@/utils/telemetry';
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
  // streak_protection_v1
  streakFreezes: number;
  freezeProgressXP: number;
  pendingMilestone: { streakKey: keyof Streaks; tier: MilestoneTier } | null;
  pendingStreakLoss: { streakKey: keyof Streaks; lostCount: number } | null;
  // variable_rewards_v1 — owned companion-cosmetic ids (chest drops).
  cosmetics: string[];

  loadFromDB: (userId: string) => void;
  completeBlock: (userId: string, module: string, completedCount: number, totalCount: number) => void;
  completeGoalNode: (userId: string, goalType: string, level: string) => void;
  addXP: (userId: string, amount: number) => void;
  /**
   * The single XP grant path: appends an immutable xp_events ledger row,
   * accrues streak-freeze progress, bumps counters, detects level-ups.
   * All XP awards should flow through here (addXP delegates).
   */
  grantXP: (userId: string, input: XpGrantInput) => void;
  triggerStreak: (userId: string, streakType: keyof Streaks) => void;
  /** Recovery CTA: restore a streak lost within the last 24h. */
  restoreStreak: (userId: string, streakType: keyof Streaks) => boolean;
  /** Chest drop: bank one streak freeze (clamped — lootTable converts overflow to XP). */
  addFreeze: (userId: string) => void;
  /** Chest drop: own a cosmetic. Sorted union, mirroring mergeGamification. */
  addCosmetic: (userId: string, cosmeticId: string) => void;
  awardBadge: (userId: string, badgeId: BadgeId) => void;
  popBadge: () => BadgeId | undefined;
  advanceQuest: (id: string, delta?: number) => void;
  resetDailyQuestsIfNeeded: () => void;
  dismissLevelUp: () => void;
  dismissMilestone: () => void;
  dismissStreakLoss: () => void;
}

/** Runtime kill switch for the whole streak-protection layer. */
function streakProtectionOn(): boolean {
  return useFlagStore.getState().isEnabled('streak_protection_v1');
}

interface XpApplication {
  totalXP: number;
  weeklyXP: number;
  streakFreezes: number;
  freezeProgressXP: number;
}

/**
 * Apply an XP amount to the counters + freeze bank in one pure step. Every
 * XP-granting action uses this so freeze accrual can't drift between paths.
 */
function applyXp(
  state: Pick<XpApplication, 'totalXP' | 'weeklyXP' | 'streakFreezes' | 'freezeProgressXP'>,
  amount: number,
): XpApplication {
  const accrual = streakProtectionOn()
    ? accrueFreezeProgress(state.freezeProgressXP, state.streakFreezes, amount)
    : { freezeProgressXP: state.freezeProgressXP, streakFreezes: state.streakFreezes, freezesEarned: 0 };
  if (accrual.freezesEarned > 0) {
    track(EVENTS.streakFreezeEarned, { count: accrual.freezesEarned });
  }
  return {
    totalXP: state.totalXP + amount,
    weeklyXP: state.weeklyXP + amount,
    streakFreezes: accrual.streakFreezes,
    freezeProgressXP: accrual.freezeProgressXP,
  };
}

/** Best-effort ledger append — losing a row must never break the grant. */
function recordXpEvent(userId: string, input: XpGrantInput): void {
  try {
    insertXpEvent(userId, input);
  } catch {
    /* the counters above are the user-visible truth; ledger is additive */
  }
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

/**
 * The install floor for every domain score — a fresh account's radar renders
 * at this value, and loadFromDB clamps every score up to it, so scores can
 * never return to the all-floor state once any domain diverges. Exported for
 * the zero-state radar caption's visibility check (cold_start_v1, §3.7).
 */
export const DOMAIN_SCORE_FLOOR = 15;

const DEFAULT_SCORES: DomainScores = {
  goals: DOMAIN_SCORE_FLOOR,
  health: DOMAIN_SCORE_FLOOR,
  finance: DOMAIN_SCORE_FLOOR,
  career: DOMAIN_SCORE_FLOOR,
  social: DOMAIN_SCORE_FLOOR,
  polymath: DOMAIN_SCORE_FLOOR,
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
  streakFreezes: 0,
  freezeProgressXP: 0,
  pendingMilestone: null,
  pendingStreakLoss: null,
  cosmetics: [],

  loadFromDB: (userId) => {
    const game = getOrCreateGamification(userId);
    let scores = DEFAULT_SCORES;
    let streaks = DEFAULT_STREAKS;
    let badges: BadgeId[] = [];
    try {
      const parsed = JSON.parse(game.domainScores) as DomainScores;
      scores = {
        goals: Math.max(DOMAIN_SCORE_FLOOR, parsed.goals ?? 0),
        health: Math.max(DOMAIN_SCORE_FLOOR, parsed.health ?? 0),
        finance: Math.max(DOMAIN_SCORE_FLOOR, parsed.finance ?? 0),
        career: Math.max(DOMAIN_SCORE_FLOOR, parsed.career ?? 0),
        social: Math.max(DOMAIN_SCORE_FLOOR, parsed.social ?? 0),
        // Read-alias: coalesce legacy `mind` into `polymath` so existing
        // gamification rows aren't zeroed by the BUG-009 rename.
        polymath: Math.max(DOMAIN_SCORE_FLOOR, parsed.polymath ?? (parsed as { mind?: number }).mind ?? 0),
      };
    } catch { /* keep default */ }
    // Merge OVER the defaults — a fresh user's row stores streaks as '{}',
    // and replacing wholesale would drop every per-type key (workout,
    // learning, …). triggerStreak would then call updateStreak(undefined)
    // and throw on `streak.lastDate`, so the streak never saves. Merging
    // guarantees all five keys are always present.
    try { streaks = { ...DEFAULT_STREAKS, ...JSON.parse(game.streaks) }; } catch { /* keep default */ }
    try { badges = JSON.parse(game.badges); } catch { /* keep default */ }
    let cosmetics: string[] = [];
    try {
      const parsed = JSON.parse(game.cosmetics ?? '[]');
      if (Array.isArray(parsed)) cosmetics = parsed.filter((v): v is string => typeof v === 'string');
    } catch { /* keep default */ }

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
      cosmetics,
      totalXP: game.totalXP,
      weeklyXP: game.weeklyXP,
      streakFreezes: game.streakFreezes ?? 0,
      freezeProgressXP: game.freezeProgressXP ?? 0,
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

    // Snapshot cumulative XP the same way so the Rewards "7-day XP" chart shows
    // real earned-per-day instead of mock data. Idempotent within a UTC day.
    import('./useXpHistoryStore').then(({ useXpHistoryStore }) =>
      useXpHistoryStore.getState().record(game.totalXP),
    ).catch(() => { /* non-fatal */ });
  },

  completeBlock: (userId, module, completedCount, totalCount) => {
    const { domainScores, badges, streaks, lastKnownLevel } = get();

    // XP is credited for EVERY completed block, including non-domain modules
    // (rest/meal/work). This is the single source of block-completion XP —
    // callers must NOT also call addXP(completeBlock) or they'd double-credit
    // (QA RW-01/double-credit fix). The domain-score bump below is gated on a
    // known domain; non-domain blocks still earn XP but move no domain score.
    const domain = MODULE_TO_DOMAIN[module];
    const xp = applyXp(get(), XP_VALUES.completeBlock);
    recordXpEvent(userId, { amount: XP_VALUES.completeBlock, domain: domain ?? null, source: 'block' });

    const newScores = { ...domainScores };
    if (domain) {
      newScores[domain] = calculateDomainScore(completedCount, totalCount, newScores[domain]);
    }

    const newBadges = checkBadges(badges, { domainScores: newScores, streaks });
    const allBadges = [...badges, ...newBadges];

    updateGamification(userId, {
      domainScores: JSON.stringify(newScores),
      badges: JSON.stringify(allBadges),
      totalXP: xp.totalXP,
      weeklyXP: xp.weeklyXP,
      streakFreezes: xp.streakFreezes,
      freezeProgressXP: xp.freezeProgressXP,
    });

    const newLevel = levelFromXP(xp.totalXP);
    set({
      domainScores: newScores,
      badges: allBadges,
      totalXP: xp.totalXP,
      weeklyXP: xp.weeklyXP,
      streakFreezes: xp.streakFreezes,
      freezeProgressXP: xp.freezeProgressXP,
      lastKnownLevel: newLevel,
      pendingLevelUp: newLevel > lastKnownLevel ? newLevel : get().pendingLevelUp,
      pendingBadges: [...get().pendingBadges, ...newBadges],
    });

    // Snapshot the new XP + scores so the Rewards charts reflect this completion
    // immediately, rather than only on the next focus/loadFromDB. Mirrors
    // completeGoalNode (domain history) + loadFromDB (XP history); idempotent
    // within a UTC day, so repeated completions just refresh today's point.
    import('./useDomainHistoryStore').then(({ useDomainHistoryStore }) =>
      useDomainHistoryStore.getState().record(newScores),
    ).catch(() => { /* non-fatal */ });
    import('./useXpHistoryStore').then(({ useXpHistoryStore }) =>
      useXpHistoryStore.getState().record(xp.totalXP),
    ).catch(() => { /* non-fatal */ });

    // Routine quest — every completed block ticks toward "Complete morning routine".
    get().advanceQuest('q_routine', 1);
    // quests_v2: same event, DB-backed metric (no-op while the flag is off).
    tickQuestMetric(userId, 'blocks_completed', 1);
  },

  completeGoalNode: (userId, goalType, level) => {
    const { domainScores, badges, lastKnownLevel } = get();
    const domain = GOALTYPE_TO_DOMAIN[goalType] ?? 'goals';
    const delta = GOAL_LEVEL_BUMP[level] ?? GOAL_LEVEL_BUMP.daily;

    const newScores = { ...domainScores };
    newScores[domain] = bumpDomainScore(newScores[domain], delta);

    // A finished daily task is worth a task; a finished milestone is worth more.
    const xpGain = level === 'daily' ? XP_VALUES.completeGoalTask : XP_VALUES.completeGoalTask * 2;
    const xp = applyXp(get(), xpGain);
    recordXpEvent(userId, { amount: xpGain, domain, source: 'goal_task' });

    // The 'Goal Crusher' badge fires only when the whole life goal is done.
    const newBadges = checkBadges(badges, {
      domainScores: newScores,
      completedGoal: level === 'life',
    });
    const allBadges = [...badges, ...newBadges];

    updateGamification(userId, {
      domainScores: JSON.stringify(newScores),
      badges: JSON.stringify(allBadges),
      totalXP: xp.totalXP,
      weeklyXP: xp.weeklyXP,
      streakFreezes: xp.streakFreezes,
      freezeProgressXP: xp.freezeProgressXP,
    });

    const newLevel = levelFromXP(xp.totalXP);
    set({
      domainScores: newScores,
      badges: allBadges,
      totalXP: xp.totalXP,
      weeklyXP: xp.weeklyXP,
      streakFreezes: xp.streakFreezes,
      freezeProgressXP: xp.freezeProgressXP,
      lastKnownLevel: newLevel,
      pendingLevelUp: newLevel > lastKnownLevel ? newLevel : get().pendingLevelUp,
      pendingBadges: [...get().pendingBadges, ...newBadges],
    });

    // Snapshot the new scores so the Life Score trend/sparkline reflects the
    // completion immediately (mirrors loadFromDB's history record).
    import('./useDomainHistoryStore').then(({ useDomainHistoryStore }) =>
      useDomainHistoryStore.getState().record(newScores),
    ).catch(() => { /* non-fatal */ });

    // quests_v2: a goal node moved forward (no-op while the flag is off).
    tickQuestMetric(userId, 'goal_task', 1);
  },

  addXP: (userId, amount) => {
    // Legacy entry — kept for existing call sites; routes through the ledger.
    get().grantXP(userId, { amount, source: 'misc' });
  },

  grantXP: (userId, input) => {
    const { lastKnownLevel } = get();
    const xp = applyXp(get(), input.amount);
    recordXpEvent(userId, input);
    const newLevel = levelFromXP(xp.totalXP);
    updateGamification(userId, {
      totalXP: xp.totalXP,
      weeklyXP: xp.weeklyXP,
      streakFreezes: xp.streakFreezes,
      freezeProgressXP: xp.freezeProgressXP,
    });
    set({
      totalXP: xp.totalXP,
      weeklyXP: xp.weeklyXP,
      streakFreezes: xp.streakFreezes,
      freezeProgressXP: xp.freezeProgressXP,
      lastKnownLevel: newLevel,
      pendingLevelUp: newLevel > lastKnownLevel ? newLevel : get().pendingLevelUp,
    });
  },

  triggerStreak: (userId, streakType) => {
    const { streaks, badges, streakFreezes } = get();
    const protectionOn = streakProtectionOn();
    const prior = streaks[streakType];
    const result = advanceStreak(prior, {
      today: localDayISO(),
      // Flag off ⇒ no freezes offered ⇒ the engine reproduces the legacy
      // grace/reset ladder exactly (extra JSON fields are additive/ignored).
      freezesAvailable: protectionOn ? streakFreezes : 0,
    });

    let nextStreak = result.next;
    let newFreezes = streakFreezes;
    let pendingMilestone = get().pendingMilestone;
    let pendingStreakLoss = get().pendingStreakLoss;

    if (result.freezeConsumed) {
      newFreezes = Math.max(0, streakFreezes - 1);
      useRewardQueueStore.getState().enqueue({
        type: 'streakSave',
        label: STREAK_META[streakType].label,
        count: nextStreak.count,
      });
      track(EVENTS.streakFreezeUsed, { streak: streakType, count: nextStreak.count });
    }
    if (protectionOn && result.milestoneCrossed) {
      nextStreak = markMilestoneCelebrated(nextStreak, result.milestoneCrossed);
      pendingMilestone = { streakKey: streakType, tier: result.milestoneCrossed };
      track(EVENTS.streakMilestone, { streak: streakType, tier: result.milestoneCrossed });
      // R2: the big identity tiers (30/100/365) also drop a chest. 7-day
      // milestones fire weekly across five streak types — too frequent for a
      // variable reward to stay special. No-op while variable_rewards_v1 is
      // off; capped ≤1/day inside.
      if (result.milestoneCrossed >= 30) maybeGrantChest(userId, 'milestone');
    }
    if (result.lost) {
      // Surface recovery only for runs worth mourning (mirrors the cognition
      // layer's MIN_STREAK_TO_PROTECT). Copy stays warm — see StreakRecoveryCard.
      if (protectionOn && prior.count >= 3) {
        pendingStreakLoss = { streakKey: streakType, lostCount: prior.count };
      }
      track(EVENTS.streakLost, { streak: streakType, count: prior.count });
    }

    const updated = { ...streaks, [streakType]: nextStreak };
    const newBadges = checkBadges(badges, { streaks: updated });
    const allBadges = [...badges, ...newBadges];

    updateGamification(userId, {
      streaks: JSON.stringify(updated),
      badges: JSON.stringify(allBadges),
      streakFreezes: newFreezes,
    });

    set({
      streaks: updated,
      badges: allBadges,
      streakFreezes: newFreezes,
      pendingMilestone,
      pendingStreakLoss,
      pendingBadges: [...get().pendingBadges, ...newBadges],
    });
  },

  restoreStreak: (userId, streakType) => {
    const { streaks, badges } = get();
    const restored = restoreFromLoss(streaks[streakType], localDayISO());
    if (!restored) {
      // Window passed — clear the stale card so it can't dangle forever.
      if (get().pendingStreakLoss?.streakKey === streakType) set({ pendingStreakLoss: null });
      return false;
    }

    const updated = { ...streaks, [streakType]: restored };
    const newBadges = checkBadges(badges, { streaks: updated });
    const allBadges = [...badges, ...newBadges];

    updateGamification(userId, {
      streaks: JSON.stringify(updated),
      badges: JSON.stringify(allBadges),
    });

    set({
      streaks: updated,
      badges: allBadges,
      pendingStreakLoss: null,
      pendingBadges: [...get().pendingBadges, ...newBadges],
    });
    track(EVENTS.streakRecovered, { streak: streakType, count: restored.count });
    return true;
  },

  addFreeze: (userId) => {
    // Spendable counter ⇒ LWW in mergeGamification — write the new absolute
    // value, never a delta. Clamped defensively: lootTable converts a roll on
    // a full bank to XP, so this should never actually hit the ceiling.
    const next = Math.min(MAX_FREEZES_BANKED, get().streakFreezes + 1);
    updateGamification(userId, { streakFreezes: next });
    set({ streakFreezes: next });
  },

  addCosmetic: (userId, cosmeticId) => {
    const { cosmetics } = get();
    if (cosmetics.includes(cosmeticId)) return;
    // Sorted union — byte-identical to what mergeGamification produces, so a
    // local add and a sync merge can never disagree on ordering.
    const next = [...cosmetics, cosmeticId].sort();
    updateGamification(userId, { cosmetics: JSON.stringify(next) });
    set({ cosmetics: next });
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
  dismissMilestone: () => set({ pendingMilestone: null }),
  dismissStreakLoss: () => set({ pendingStreakLoss: null }),
}));
