import { useEffect, useRef, useState } from 'react';
import { useFlagStore } from '@/store/useFlagStore';
import { detectComeback, markComebackHandled } from '@/utils/retention';
import { maybeGrantChest } from '@/gamification/chestGrants';
import { insertQuest, getQuestsByDay } from '@/db/queries/quests';
import { localDayISO } from '@/db/queries/xpEvents';
import { track, EVENTS } from '@/utils/telemetry';
import type { QuestDraft } from '@/gamification/questEngine';

/**
 * Comeback orchestration (R4, flag: comeback_v1). Runs once per Today mount:
 * a 3–90 day gap since the previous open →
 *   - comeback chest (source 'comeback'; shares the global ≤1/day cap)
 *   - an `ease_back` recovery quest — ONE small block, gentle XP (only when
 *     quests_v2 is also live; a quest row nobody can see helps no one)
 *   - the ComebackSheet (the caller renders it while `days` is set)
 *
 * Everything here is a WELCOME, not a debt: nothing expires, nothing was
 * lost while away, and dismissing the sheet costs nothing.
 */

export const EASE_BACK_QUEST: QuestDraft = {
  templateId: 'ease_back',
  title: 'Ease back in — one small block',
  module: 'goal',
  metricKey: 'blocks_completed',
  target: 1,
  xp: 30,
};

interface ComebackState {
  /** Days away, when a comeback was detected this session — drives the sheet. */
  days: number | null;
  dismiss: () => void;
  /** CTA: user accepted the easing-in plan. */
  claim: () => void;
}

export function useComeback(userId: string | null): ComebackState {
  const enabled = useFlagStore((s) => s.isEnabled('comeback_v1'));
  const questsV2 = useFlagStore((s) => s.isEnabled('quests_v2'));
  const [days, setDays] = useState<number | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (!enabled || !userId || ranRef.current) return;
    ranRef.current = true;
    void (async () => {
      try {
        const gap = await detectComeback();
        if (gap === null) return;
        track(EVENTS.comebackDetected, { days: gap });

        // The chest is the tangible welcome-back. Shares the daily cap, so a
        // same-day peak beat can't stack a second chest on top.
        maybeGrantChest(userId, 'comeback');

        // Recovery quest — idempotent per day via the templateId guard.
        if (questsV2) {
          const today = localDayISO();
          const existing = getQuestsByDay(userId, today);
          if (!existing.some((q) => q.templateId === EASE_BACK_QUEST.templateId)) {
            insertQuest(userId, today, EASE_BACK_QUEST, 'template');
          }
        }

        await markComebackHandled();
        setDays(gap);
      } catch {
        /* a comeback failure must never block Today from loading */
      }
    })();
  }, [enabled, questsV2, userId]);

  return {
    days,
    dismiss: () => setDays(null),
    claim: () => {
      track(EVENTS.comebackClaimed, { days });
      setDays(null);
    },
  };
}
