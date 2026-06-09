/**
 * Daily quests v2 orchestration (quests_v2) — clone of the useDailyBriefing
 * pattern: templates render INSTANTLY (synchronous insert on first focus,
 * works offline/mock), then one AI personalization call per local day
 * upgrades any quest still at progress 0. AI failure degrades silently to
 * the template titles — the quest list is never empty or blocked on a call.
 */

import { useEffect, useMemo, useRef } from 'react';
import { format, subDays } from 'date-fns';
import { useQuestStore } from '@/store/useQuestStore';
import { useGameStore } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { useFlagStore } from '@/store/useFlagStore';
import { generateDailyQuests } from '@/ai/functions';
import { localDayISO } from '@/db/queries/xpEvents';
import type { QuestSelectionCtx } from '@/gamification/questEngine';
import type { QuestRecord } from '@/db/queries/quests';
import { getRoutineBlocksByDate } from '@/db/queries/routine';
import { getLatestInsight } from '@/db/queries/cognitiveInsights';
import type { DomainId } from '@/store/useUserStore';

// Module-level day guard (not per-mount): several screens use this hook, but
// the AI pass must fire at most once per local day across all of them.
let aiRequestedFor: string | null = null;

export interface DailyQuestsApi {
  enabled: boolean;
  quests: QuestRecord[];
  claim: (questId: string) => boolean;
  reroll: (questId: string) => boolean;
  /** True when today's free reroll is still available. */
  canReroll: boolean;
}

function buildCtx(userId: string, primaryDomains: string[], liveStreakKeys: string[]): QuestSelectionCtx {
  // Yesterday's plan-completion ratio scales difficulty (default 0.5 on no data).
  let yesterdayCompletionPct = 0.5;
  try {
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const blocks = getRoutineBlocksByDate(yesterday) as { status: string }[];
    if (blocks.length > 0) {
      yesterdayCompletionPct = blocks.filter((b) => b.status === 'completed').length / blocks.length;
    }
  } catch { /* keep default */ }

  // Stagnation insights are per-domain — scan for any non-expired active one.
  // Maps DomainId → quest module key (only 'goals' differs).
  let stagnantDomain: string | null = null;
  try {
    const domains: DomainId[] = ['goals', 'health', 'finance', 'career', 'social', 'polymath'];
    const now = new Date().toISOString();
    for (const d of domains) {
      const insight = getLatestInsight(userId, 'domain_stagnation', d);
      const live = insight && (insight.status === 'proposed' || insight.status === 'shown');
      if (live && insight.expiresAt != null && insight.expiresAt > now) {
        stagnantDomain = d === 'goals' ? 'goal' : d;
        break;
      }
    }
  } catch { /* cognition layer optional — quests work without it */ }

  return { primaryDomains, liveStreakKeys, stagnantDomain, yesterdayCompletionPct };
}

export function useDailyQuests(): DailyQuestsApi {
  const enabled = useFlagStore((s) => s.isEnabled('quests_v2'));
  const userId = useUserStore((s) => s.userId);
  const primaryDomains = useUserStore((s) => s.primaryDomains);
  const streaks = useGameStore((s) => s.streaks);
  const quests = useQuestStore((s) => s.quests);
  const ensureToday = useQuestStore((s) => s.ensureToday);
  const claimAction = useQuestStore((s) => s.claim);
  const rerollAction = useQuestStore((s) => s.reroll);
  const upgradeFromAI = useQuestStore((s) => s.upgradeFromAI);

  const liveStreakKeys = useMemo(
    () => Object.entries(streaks).filter(([, s]) => s.count > 0).map(([k]) => k),
    [streaks],
  );

  const ctxRef = useRef<QuestSelectionCtx | null>(null);

  useEffect(() => {
    if (!enabled || !userId) return;
    const today = localDayISO();
    const ctx = buildCtx(userId, primaryDomains ?? [], liveStreakKeys);
    ctxRef.current = ctx;
    ensureToday(userId, ctx);

    if (aiRequestedFor === today) return;
    aiRequestedFor = today;
    const drafts = useQuestStore.getState().quests
      .filter((q) => q.status === 'active' && q.progress === 0 && q.source === 'template')
      .map((q) => ({
        templateId: q.templateId ?? '',
        title: q.title,
        metricKey: q.metricKey,
        target: q.target,
        xp: q.xp,
      }));
    if (drafts.length === 0) return;

    generateDailyQuests({
      drafts,
      primaryDomains: primaryDomains ?? [],
      topGoal: null, // kept lean — title personalization works without it
      liveStreaks: Object.entries(streaks)
        .filter(([, s]) => s.count > 0)
        .map(([key, s]) => ({ key, count: s.count })),
      yesterdayCompletionPct: ctx.yesterdayCompletionPct ?? 0.5,
      stagnantDomain: ctx.stagnantDomain ?? null,
    })
      .then((res) => {
        if (res) upgradeFromAI(userId, res);
      })
      .catch(() => {
        // Allow a retry on the next mount if the call failed outright.
        aiRequestedFor = null;
      });
    // liveStreakKeys is derived from streaks; primaryDomains is stable per user.
  }, [enabled, userId, primaryDomains, liveStreakKeys, streaks, ensureToday, upgradeFromAI]);

  return {
    enabled,
    quests,
    claim: (questId) => (userId ? claimAction(userId, questId) : false),
    reroll: (questId) =>
      userId && ctxRef.current ? rerollAction(userId, questId, ctxRef.current) : false,
    canReroll: !quests.some((q) => q.status === 'rerolled'),
  };
}
