import {
  computeRecoveryScore,
  recoveryFromFitDays,
  recoveryBand,
  RECOVERY_SOFTEN_THRESHOLD,
} from '../recovery';
import type { DailyFitPoint } from '@/integrations/googleFit/client';

describe('computeRecoveryScore', () => {
  it('reports no data when given no usable signals', () => {
    const r = computeRecoveryScore({});
    expect(r.hasData).toBe(false);
    expect(r.score).toBe(0);
  });

  it('scores a well-rested day high', () => {
    const r = computeRecoveryScore({
      sleepHours: 8,
      deepSleepPct: 20,
      avgHeartRate: 58,
      hrBaselineBpm: 58,
      priorActiveMinutes: 40,
    });
    expect(r.hasData).toBe(true);
    expect(r.band).toBe('high');
    expect(r.score).toBeGreaterThanOrEqual(67);
    expect(r.drivers.length).toBeGreaterThan(0);
  });

  it('scores a poor night low (below the soften threshold)', () => {
    const r = computeRecoveryScore({ sleepHours: 4, deepSleepPct: 6 });
    expect(r.band).toBe('low');
    expect(r.score).toBeLessThan(RECOVERY_SOFTEN_THRESHOLD);
  });

  it('penalises an elevated resting HR vs baseline', () => {
    const rested = computeRecoveryScore({ sleepHours: 7, avgHeartRate: 55, hrBaselineBpm: 55 });
    const strained = computeRecoveryScore({ sleepHours: 7, avgHeartRate: 66, hrBaselineBpm: 55 });
    expect(strained.score).toBeLessThan(rested.score);
  });

  it('works from sleep alone (graceful degradation)', () => {
    const r = computeRecoveryScore({ sleepHours: 7.5 });
    expect(r.hasData).toBe(true);
    expect(r.drivers[0]).toMatch(/sleep/);
  });
});

describe('recoveryBand', () => {
  it('bands by score', () => {
    expect(recoveryBand(80)).toBe('high');
    expect(recoveryBand(50)).toBe('moderate');
    expect(recoveryBand(30)).toBe('low');
    expect(recoveryBand(RECOVERY_SOFTEN_THRESHOLD)).toBe('moderate');
  });
});

describe('recoveryFromFitDays', () => {
  const day = (date: string, over: Partial<DailyFitPoint>): DailyFitPoint => ({
    date,
    steps: 6000,
    activeMinutes: 30,
    heartPoints: 10,
    caloriesBurned: 2000,
    distanceMeters: 4000,
    avgHeartRate: 60,
    maxHeartRate: 120,
    minHeartRate: 50,
    sleep: { awake: 20, light: 200, deep: 90, rem: 80, total: 370 },
    spo2: null,
    bodyFatPct: null,
    systolic: null,
    diastolic: null,
    weightKg: null,
    ...over,
  });

  it('uses the latest day for sleep/HR and prior days for the baseline', () => {
    const days = [
      day('2026-05-29', { avgHeartRate: 58 }),
      day('2026-05-30', { avgHeartRate: 58 }),
      day('2026-05-31', { avgHeartRate: 58, sleep: { awake: 15, light: 210, deep: 95, rem: 85, total: 390 } }),
    ];
    const r = recoveryFromFitDays(days);
    expect(r.hasData).toBe(true);
    expect(r.score).toBeGreaterThan(0);
  });

  it('returns no data for an empty window', () => {
    expect(recoveryFromFitDays([]).hasData).toBe(false);
  });
});
