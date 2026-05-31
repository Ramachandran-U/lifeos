import { useCallback, useState } from 'react';
import { rebalanceRestOfToday, isRecoveryLow, generateAndSaveWeek } from '@/ai/replanApply';
import { getUserProfile } from '@/db/queries/userProfile';
import { getReflectionByDate } from '@/db/queries/reflections';
import { getLatestSleepHours, getLatestRecoveryScore } from '@/db/queries/health';
import { RECOVERY_SOFTEN_THRESHOLD } from '@/utils/recovery';
import { emptyUserProfile } from '@/ai/types';
import { track, EVENTS } from '@/utils/telemetry';

export interface UseReplanFlowArgs {
  userId: string | null;
  today: string;                       // yyyy-MM-dd
  primaryDomains: string[];
  /** Count of blocks the user skipped today (drives the "Re-plan rest of day" CTA). */
  skippedCount: number;
  /** Whether the onboarding-v2 surface area is enabled. The replan CTA only shows for v2 users. */
  onboardingV2: boolean;
  /** Called after a successful re-plan or week-plan so the screen refreshes. */
  refresh: () => void;
}

export interface UseReplanFlowResult {
  replanning: boolean;
  planningWeek: boolean;
  rationale: string | null;
  /** True when the "Re-plan rest of day" CTA should be visible. */
  showReplanCta: boolean;
  /** Re-plan today only — softens for recovery if sleep / mood signal low. */
  handleReplan: () => Promise<void>;
  /** Generate + save the next 7 days. */
  handlePlanWeek: () => Promise<void>;
}

/**
 * Encapsulates the two replan flows the Today screen exposes:
 *   - `handleReplan`        re-plans the remainder of today
 *   - `handlePlanWeek`      generates the next 7 days
 *
 * Both share a single `rationale` slot that the screen renders as the user-facing
 * status string (success message, "no changes needed", or the error message —
 * we deliberately reuse one slot rather than two so the UI stays simple).
 */
export function useReplanFlow(args: UseReplanFlowArgs): UseReplanFlowResult {
  const { userId, today, primaryDomains, skippedCount, onboardingV2, refresh } = args;
  const [replanning, setReplanning] = useState(false);
  const [planningWeek, setPlanningWeek] = useState(false);
  const [rationale, setRationale] = useState<string | null>(null);

  const handlePlanWeek = useCallback(async () => {
    if (!userId || planningWeek) return;
    setPlanningWeek(true);
    setRationale(null);
    try {
      // Legacy users (day-1 onboarding, not discovery-chat) have no
      // user_profiles row — fall back to an empty profile rather than silently
      // doing nothing, so "Plan my next 7 days" always responds.
      const profile = (await getUserProfile(userId)) ?? emptyUserProfile('form');
      await generateAndSaveWeek({
        userId,
        startDate: today,
        profile,
        primaryDomains,
      });
      setRationale('Your next 7 days are planned.');
      refresh();
    } catch (err) {
      setRationale(err instanceof Error ? err.message : 'Week plan failed. Try again.');
    } finally {
      setPlanningWeek(false);
    }
  }, [userId, planningWeek, today, primaryDomains, refresh]);

  const handleReplan = useCallback(async () => {
    if (!userId || replanning) return;
    setReplanning(true);
    setRationale(null);
    try {
      const profile = await getUserProfile(userId);
      if (!profile) {
        setRationale('No profile yet — finish onboarding to unlock re-plan.');
        return;
      }
      const reflection = getReflectionByDate(today);
      // Prefer the graded recovery score (Fit-derived) when today's is available;
      // fall back to the coarse sleep/mood/skipped heuristic otherwise.
      const recoveryScore = getLatestRecoveryScore(1);
      const soften =
        (recoveryScore != null && recoveryScore < RECOVERY_SOFTEN_THRESHOLD) ||
        isRecoveryLow({
          lastSleepHours: getLatestSleepHours(3),
          skippedTodayCount: skippedCount,
          lastMood: reflection?.mood ?? null,
        });
      const { rationale: rebalanceRationale, changeCount } =
        await rebalanceRestOfToday({ profile, softenForRecovery: soften });
      track(EVENTS.routineReplanned, { soften, changes: changeCount });
      setRationale(
        changeCount > 0 ? rebalanceRationale : 'Looks balanced — no changes needed.',
      );
      refresh();
    } catch (err) {
      setRationale(err instanceof Error ? err.message : 'Re-plan failed. Try again.');
    } finally {
      setReplanning(false);
    }
  }, [userId, replanning, today, skippedCount, refresh]);

  return {
    replanning,
    planningWeek,
    rationale,
    showReplanCta: onboardingV2 && skippedCount > 0 && !replanning,
    handleReplan,
    handlePlanWeek,
  };
}
