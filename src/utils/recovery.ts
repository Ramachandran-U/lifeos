import type { DailyFitPoint } from '@/integrations/googleFit/client';

/**
 * Recovery / readiness score (0–100) — Oura/Whoop-style, rule-based (no AI).
 * Synthesises last night's sleep, deep-sleep quality, heart-rate vs the user's
 * recent baseline, and prior-day training load into one number, plus a band and
 * a few human-readable drivers.
 *
 * Only signals that are present contribute — the weights renormalise — so it
 * degrades gracefully from "full Google Fit" down to "just a logged sleep
 * duration". When the score is low, the Routine Builder eases the rest of the
 * day (see useReplanFlow → softenForRecovery, threshold below).
 */

export type RecoveryBand = 'low' | 'moderate' | 'high';

export interface RecoverySignals {
  sleepHours?: number | null;
  /** Target sleep (defaults to 8h). */
  sleepNeedHours?: number;
  deepSleepPct?: number | null;
  /** Today's average HR (resting proxy). */
  avgHeartRate?: number | null;
  /** Recent baseline average HR to compare against. */
  hrBaselineBpm?: number | null;
  /** Yesterday's active minutes — heavy load lowers today's readiness. */
  priorActiveMinutes?: number | null;
}

export interface RecoveryResult {
  score: number;
  band: RecoveryBand;
  drivers: string[];
  /** false when no usable signal was provided (caller shows an empty/connect state). */
  hasData: boolean;
}

/** Below this score, the intra-day replan softens the remaining plan. */
export const RECOVERY_SOFTEN_THRESHOLD = 45;

export function recoveryBand(score: number): RecoveryBand {
  if (score >= 67) return 'high';
  if (score >= RECOVERY_SOFTEN_THRESHOLD) return 'moderate';
  return 'low';
}

export function recoveryBandLabel(band: RecoveryBand): string {
  return { low: 'Take it easy', moderate: 'Balanced', high: 'Primed' }[band];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function computeRecoveryScore(s: RecoverySignals): RecoveryResult {
  const parts: Array<{ value: number; weight: number }> = [];
  const drivers: string[] = [];

  const need = s.sleepNeedHours && s.sleepNeedHours > 0 ? s.sleepNeedHours : 8;

  if (s.sleepHours != null && s.sleepHours > 0) {
    const ratio = clamp(s.sleepHours / need, 0, 1.1);
    parts.push({ value: (ratio / 1.1) * 100, weight: 0.5 });
    const h = Math.floor(s.sleepHours);
    const m = Math.round((s.sleepHours - h) * 60);
    drivers.push(`${h}h${m > 0 ? ` ${m}m` : ''} sleep`);
  }

  if (s.deepSleepPct != null && s.deepSleepPct > 0) {
    // 18% deep is a healthy midpoint; cap the contribution at 100.
    parts.push({ value: clamp(s.deepSleepPct / 18, 0, 1) * 100, weight: 0.2 });
    drivers.push(`deep sleep ${Math.round(s.deepSleepPct)}%`);
  }

  if (s.avgHeartRate != null && s.avgHeartRate > 0 && s.hrBaselineBpm != null && s.hrBaselineBpm > 0) {
    const pctOver = ((s.avgHeartRate - s.hrBaselineBpm) / s.hrBaselineBpm) * 100;
    // Each 1% above baseline costs ~6 points; at/below baseline scores full.
    parts.push({ value: clamp(100 - Math.max(0, pctOver) * 6, 0, 100), weight: 0.2 });
    drivers.push(pctOver > 4 ? 'resting HR elevated' : 'resting HR steady');
  }

  if (s.priorActiveMinutes != null && s.priorActiveMinutes >= 0) {
    // Light/moderate load is neutral-positive; >60 active min yesterday tapers
    // readiness, heavy days more so.
    parts.push({ value: clamp(100 - Math.max(0, s.priorActiveMinutes - 60) / 2, 0, 100), weight: 0.1 });
    if (s.priorActiveMinutes >= 120) drivers.push('heavy load yesterday');
  }

  if (parts.length === 0) {
    return { score: 0, band: 'low', drivers: [], hasData: false };
  }

  const totalW = parts.reduce((a, p) => a + p.weight, 0);
  const score = Math.round(parts.reduce((a, p) => a + p.value * p.weight, 0) / totalW);
  return { score, band: recoveryBand(score), drivers: drivers.slice(0, 3), hasData: true };
}

/**
 * Derive a recovery score from a window of Google Fit days: uses the latest day
 * for sleep/HR, the prior days for the HR baseline, and yesterday for load.
 */
export function recoveryFromFitDays(days: DailyFitPoint[], sleepNeedHours?: number): RecoveryResult {
  if (!days.length) return { score: 0, band: 'low', drivers: [], hasData: false };
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const today = sorted[sorted.length - 1];
  const prior = sorted.slice(0, -1);

  const hrVals = prior.map((d) => d.avgHeartRate).filter((n): n is number => n != null && n > 0);
  const hrBaseline = hrVals.length ? hrVals.reduce((a, b) => a + b, 0) / hrVals.length : null;
  const yesterday = prior.length ? prior[prior.length - 1] : null;

  return computeRecoveryScore({
    sleepHours: today.sleep.total > 0 ? today.sleep.total / 60 : null,
    sleepNeedHours,
    deepSleepPct: today.sleep.total > 0 ? (today.sleep.deep / today.sleep.total) * 100 : null,
    avgHeartRate: today.avgHeartRate,
    hrBaselineBpm: hrBaseline,
    priorActiveMinutes: yesterday?.activeMinutes ?? null,
  });
}
