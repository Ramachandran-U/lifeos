import { create } from 'zustand';
import {
  insertQuest,
  getQuestsByDay,
  getQuestById,
  updateQuest,
  type QuestRecord,
} from '@/db/queries/quests';
import { localDayISO } from '@/db/queries/xpEvents';
import {
  selectDailyQuests,
  clampDraftToTemplate,
  type QuestSelectionCtx,
  type QuestMetricKey,
} from '@/gamification/questEngine';
import type { DailyQuestGenResult } from '@/ai/types';
import { enqueueXPReward } from './useRewardQueueStore';
import { maybeGrantChest } from '@/gamification/chestGrants';
import { useFlagStore } from './useFlagStore';
import type { DomainKey } from '@/components/ui/DomainGlyph';
import { track, EVENTS } from '@/utils/telemetry';
import type { Quest } from '@/constants/gamification';

/**
 * Daily quests v2 (quests_v2) — DB-backed procedural quests.
 *
 * Replaces the legacy in-memory DEFAULT_QUESTS path (useGameStore.quests),
 * which never persisted on native and never actually awarded its XP. Rows live
 * in the `quests` table (mutation-logged); rollover is implicit via dayLocal.
 * XP is granted ONLY at claim, through useGameStore.grantXP, so the ledger and
 * freeze accrual stay on the single path.
 *
 * Renders only when useFlagStore.isEnabled('quests_v2') — callers gate.
 */

interface QuestV2State {
  dayLocal: string | null;
  quests: QuestRecord[];

  /** Idempotent: inserts today's template drafts if the day has no rows. */
  ensureToday: (userId: string, ctx: QuestSelectionCtx) => void;
  refresh: (userId: string) => void;
  /** Tick every active quest tracking `metricKey` for today. */
  advanceMetric: (userId: string, metricKey: QuestMetricKey, delta?: number) => void;
  /** Claim a completed quest — idempotent (status guard). Returns success. */
  claim: (userId: string, questId: string) => boolean;
  /** One free reroll per day, only while progress === 0. Returns success. */
  reroll: (userId: string, questId: string, ctx: QuestSelectionCtx) => boolean;
  /** Apply the AI personalization pass to quests still at progress 0. */
  upgradeFromAI: (userId: string, result: DailyQuestGenResult) => void;
}

const MODULE_TO_DOMAIN_KEY: Record<string, DomainKey | undefined> = {
  goal: 'goal', health: 'health', finance: 'finance',
  career: 'career', social: 'social', polymath: 'polymath',
};

export const useQuestStore = create<QuestV2State>((set, get) => ({
  dayLocal: null,
  quests: [],

  ensureToday: (userId, ctx) => {
    const today = localDayISO();
    let rows = getQuestsByDay(userId, today);
    if (rows.length === 0) {
      const drafts = selectDailyQuests(ctx, `${userId}:${today}`);
      // The day-1 pinned first quest carries source 'pinned' (cold_start_v1);
      // everything procedural stays 'template'.
      for (const draft of drafts) insertQuest(userId, today, draft, draft.source ?? 'template');
      rows = getQuestsByDay(userId, today);
      track(EVENTS.questGenerated, { source: 'template', count: rows.length });
    }
    set({ dayLocal: today, quests: rows });
  },

  refresh: (userId) => {
    const today = localDayISO();
    set({ dayLocal: today, quests: getQuestsByDay(userId, today) });
  },

  advanceMetric: (userId, metricKey, delta = 1) => {
    const today = localDayISO();
    // Read fresh — a stale in-memory day must never tick yesterday's quests.
    const rows = getQuestsByDay(userId, today);
    let changed = false;
    for (const q of rows) {
      if (q.metricKey !== metricKey || q.status !== 'active') continue;
      const progress = Math.min(q.target, q.progress + delta);
      const status = progress >= q.target ? 'completed' : 'active';
      updateQuest(q.id, { progress, status });
      if (status === 'completed') track(EVENTS.questCompleted, { template: q.templateId ?? q.metricKey });
      changed = true;
    }
    if (changed) set({ dayLocal: today, quests: getQuestsByDay(userId, today) });
  },

  claim: (userId, questId) => {
    const q = getQuestById(questId);
    // Status guard makes claim idempotent — double-taps can't double-credit.
    if (!q || q.status !== 'completed') return false;
    updateQuest(questId, { status: 'claimed' });

    // Grant through the single XP path (ledger + freeze accrual + level-up),
    // then surface the beat (grantXP itself never enqueues — call sites do).
    import('./useGameStore').then(({ useGameStore }) => {
      useGameStore.getState().grantXP(userId, {
        amount: q.xp,
        domain: q.module,
        source: 'quest',
        refId: questId,
      });
    }).catch(() => { /* XP grant failing must not lose the claim */ });
    enqueueXPReward(q.xp, MODULE_TO_DOMAIN_KEY[q.module]);
    track(EVENTS.questClaimed, { template: q.templateId ?? q.metricKey, xp: q.xp });

    get().refresh(userId);

    // R2 (variable_rewards_v1): claiming the LAST live quest of the day is a
    // peak moment — the full sweep drops a chest. Rerolled rows don't count
    // against the sweep (they were replaced), but at least one claim must
    // exist so an all-rerolled day can't trigger it. No-op while the flag is
    // off; capped ≤1/day inside maybeGrantChest.
    const rows = get().quests;
    const live = rows.filter((r) => r.status !== 'rerolled');
    if (live.length > 0 && live.every((r) => r.status === 'claimed')) {
      maybeGrantChest(userId, 'quest_sweep');
    }
    return true;
  },

  reroll: (userId, questId, ctx) => {
    const today = localDayISO();
    const rows = getQuestsByDay(userId, today);
    const q = rows.find((r) => r.id === questId);
    if (!q || q.status !== 'active' || q.progress > 0) return false;
    // One free reroll per local day: any rerolled row marks it spent.
    if (rows.some((r) => r.status === 'rerolled')) return false;

    updateQuest(questId, { status: 'rerolled' });
    const replacementCtx: QuestSelectionCtx = {
      ...ctx,
      excludeTemplateIds: [
        ...(ctx.excludeTemplateIds ?? []),
        ...rows.map((r) => r.templateId).filter((t): t is string => !!t),
      ],
    };
    const [draft] = selectDailyQuests(replacementCtx, `${userId}:${today}:reroll:1`);
    if (draft) insertQuest(userId, today, draft, 'template');
    track(EVENTS.questRerolled, { from: q.templateId ?? q.metricKey, to: draft?.templateId ?? 'none' });

    get().refresh(userId);
    return true;
  },

  upgradeFromAI: (userId, result) => {
    const today = localDayISO();
    const rows = getQuestsByDay(userId, today);
    let changed = false;
    for (const raw of result.quests) {
      const clamped = clampDraftToTemplate(raw);
      if (!clamped) continue; // untrackable — keep the template version
      const match = rows.find(
        (r) => r.templateId === clamped.templateId && r.status === 'active' && r.progress === 0,
      );
      if (!match) continue; // already progressed/claimed — never rewrite mid-flight
      updateQuest(match.id, { title: clamped.title, target: clamped.target, xp: clamped.xp, source: 'ai' });
      changed = true;
    }
    if (changed) {
      track(EVENTS.questGenerated, { source: 'ai', count: result.quests.length });
      get().refresh(userId);
    }
  },
}));

/**
 * Flag-gated progress tick — THE entry point for feature code. Call it from
 * any site that logs a trackable activity; it's a no-op while quests_v2 is
 * off and never throws into the calling flow.
 */
export function tickQuestMetric(userId: string, metricKey: QuestMetricKey, delta = 1): void {
  if (!useFlagStore.getState().isEnabled('quests_v2')) return;
  try {
    useQuestStore.getState().advanceMetric(userId, metricKey, delta);
  } catch {
    /* quest ticking is additive — never break the activity that triggered it */
  }
}

/**
 * Adapter: render a v2 row through the existing QuestCard / QuestDetailSheet
 * components (built for the legacy Quest shape). Carries the v2 identity in
 * optional fields so detail views can claim/reroll.
 */
const QUEST_MODULES = ['goal', 'health', 'finance', 'career', 'social', 'polymath'] as const;

export function toLegacyQuest(q: QuestRecord): Quest {
  // QuestRecord.module is a plain string from storage; clamp to a known
  // module key so MODULE_META lookups can never miss.
  const module = (QUEST_MODULES as readonly string[]).includes(q.module)
    ? (q.module as Quest['module'])
    : 'goal';
  return {
    id: q.id,
    title: q.title,
    module,
    xp: q.xp,
    progress: q.progress,
    total: q.target,
    type: q.kind === 'weekly' ? 'weekly' : 'daily',
    metricKey: q.metricKey,
    status: q.status,
  };
}
