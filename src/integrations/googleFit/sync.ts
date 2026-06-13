import { syncFitDailyData } from './client';
import { createHealthLog } from '@/db/queries/health';
import { getUser } from '@/db/queries/users';
import { recoveryFromFitDays } from '@/utils/recovery';
import { useFitSyncStore } from '@/store/useFitSyncStore';
import { useGameStore } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';

const isMock =
  process.env.EXPO_PUBLIC_USE_AI_MOCK === 'true' || process.env.USE_AI_MOCK === 'true';

export interface FitSyncSummary {
  daysSynced: number;
  totalSteps: number;
  workouts: number;
  /** Average nightly sleep over the window, hours; null if none logged. */
  avgSleepHours: number | null;
  latestWeightKg: number | null;
  /** Today's recovery score (0–100) if computable. */
  recoveryScore: number | null;
  errors: string[];
}

const MOCK_SUMMARY: FitSyncSummary = {
  daysSynced: 14,
  totalSteps: 98_420,
  workouts: 3,
  avgSleepHours: 7.1,
  latestWeightKg: 72,
  recoveryScore: 68,
  errors: [],
};

/**
 * Sync Google Fit and persist the results, returning a compact summary.
 *
 * This is the single source of truth for "sync my Fit", shared by the Health
 * screen's Sync button and the voice agent's `syncGoogleFit` tool, so both do
 * the exact same persistence: latest weight, per-day sleep, today's recovery
 * score, the workout streak, and the cached Fit-sync store. The summary is what
 * the voice agent narrates ("tell me what you see").
 *
 * Stores are read via `getState()` so this works outside React (the tool runs
 * on-device during a voice turn). In mock mode it returns a fake summary instead
 * of hitting Google.
 */
export async function syncAndPersistFit(clientId: string, days = 14): Promise<FitSyncSummary> {
  if (isMock) return MOCK_SUMMARY;

  const result = await syncFitDailyData(clientId, days);

  useFitSyncStore.getState().setSync(result.days, result.workouts, Date.now());

  const latest = result.days[result.days.length - 1];
  if (latest && latest.weightKg && latest.weightKg > 0) {
    createHealthLog({ date: latest.date, weight: latest.weightKg });
  }

  // Persist sleep across the window so recovery-aware planning can read it.
  let sleepSum = 0;
  let sleepNights = 0;
  for (const day of result.days) {
    const totalMins = day.sleep.total;
    if (totalMins > 0) {
      const hours = Math.round((totalMins / 60) * 10) / 10;
      createHealthLog({ date: day.date, sleepHours: hours, source: 'health_connect' });
      sleepSum += hours;
      sleepNights += 1;
    }
  }

  const sleepTargetHours = getUser()?.sleepTargetHours ?? undefined;
  const rec = recoveryFromFitDays(result.days, sleepTargetHours);
  if (latest && rec.hasData) {
    createHealthLog({ date: latest.date, recoveryScore: rec.score });
  }

  // A workout logged today keeps the workout streak alive.
  const userId = useUserStore.getState().userId;
  if (userId && latest && result.workouts.some((w) => w.date === latest.date)) {
    useGameStore.getState().triggerStreak(userId, 'workout');
  }

  return {
    daysSynced: result.days.length,
    totalSteps: result.days.reduce((sum, d) => sum + d.steps, 0),
    workouts: result.workouts.length,
    avgSleepHours: sleepNights > 0 ? Math.round((sleepSum / sleepNights) * 10) / 10 : null,
    latestWeightKg: latest?.weightKg ?? null,
    recoveryScore: rec.hasData ? rec.score : null,
    errors: result.errors,
  };
}
