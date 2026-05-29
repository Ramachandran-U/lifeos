import {
  detectOvercommitment,
  OVERLOAD_RATIO,
  SLEEP_DEBT_HOURS,
  HIGH_SKIP_RATE,
  MIN_BASELINE_MINUTES,
  DEFAULT_SLEEP_TARGET_HOURS,
  type OvercommitmentDeps,
} from '../overcommitment';

function deps(over: Partial<OvercommitmentDeps> = {}): OvercommitmentDeps {
  return {
    plannedMinutesForDate: () => 240,
    highEnergyBlocksFor: () => 0,
    achievableBaseline: () => 180,
    lastSleepHours: () => 7,
    sleepTargetHours: () => 7.5,
    recentSkipRate: () => 0,
    recentMood: () => null,
    cooldownOk: () => true,
    ...over,
  };
}

const DATE = '2026-05-30';

describe('detectOvercommitment — silent cases', () => {
  it('stays silent below the minimum baseline (new user / sparse data)', () => {
    expect(detectOvercommitment(DATE, deps({ achievableBaseline: () => MIN_BASELINE_MINUTES - 1 }))).toBeNull();
  });

  it('stays silent during cooldown', () => {
    expect(detectOvercommitment(DATE, deps({ cooldownOk: () => false }))).toBeNull();
  });

  it('stays silent when nothing is planned', () => {
    expect(detectOvercommitment(DATE, deps({ plannedMinutesForDate: () => 0 }))).toBeNull();
  });

  it('stays silent when plan fits within capacity', () => {
    expect(detectOvercommitment(DATE, deps({
      plannedMinutesForDate: () => 180,
      achievableBaseline: () => 180,
    }))).toBeNull();
  });

  it('stays silent when slightly above baseline but below the overload ratio', () => {
    // 180 -> 220 == 1.22x, below 1.3 threshold
    expect(detectOvercommitment(DATE, deps({
      plannedMinutesForDate: () => 220,
      achievableBaseline: () => 180,
    }))).toBeNull();
  });
});

describe('detectOvercommitment — load over baseline', () => {
  it('fires when planned exceeds OVERLOAD_RATIO × baseline', () => {
    const c = detectOvercommitment(DATE, deps({
      plannedMinutesForDate: () => 270,  // 1.5x of 180
      achievableBaseline: () => 180,
    }));
    expect(c).not.toBeNull();
    expect(c?.loadRatio).toBeCloseTo(1.5, 2);
    expect(c?.reasons[0]).toMatch(/usual 180 min/);
    expect(c?.severity).toBeGreaterThan(0);
  });
});

describe('detectOvercommitment — sleep debt + high-energy', () => {
  it('fires when sleep debt ≥ threshold AND there is a high-energy block', () => {
    const c = detectOvercommitment(DATE, deps({
      plannedMinutesForDate: () => 200, // fits load otherwise
      lastSleepHours: () => 5,           // 2.5h debt vs 7.5 target
      highEnergyBlocksFor: () => 2,
    }));
    expect(c).not.toBeNull();
    expect(c?.sleepDebtHours).toBeCloseTo(2.5, 2);
    expect(c?.reasons.some((r) => r.toLowerCase().includes('sleep'))).toBe(true);
  });

  it('does NOT fire on sleep debt alone if no high-energy blocks planned', () => {
    expect(detectOvercommitment(DATE, deps({
      plannedMinutesForDate: () => 200,
      lastSleepHours: () => 5,
      highEnergyBlocksFor: () => 0,
    }))).toBeNull();
  });

  it('does NOT fire when sleep debt below threshold', () => {
    expect(detectOvercommitment(DATE, deps({
      plannedMinutesForDate: () => 200,
      lastSleepHours: () => 6,           // 1.5h debt — below SLEEP_DEBT_HOURS
      highEnergyBlocksFor: () => 2,
    }))).toBeNull();
  });

  it('falls back to DEFAULT_SLEEP_TARGET_HOURS when user has no target set', () => {
    const c = detectOvercommitment(DATE, deps({
      plannedMinutesForDate: () => 200,
      lastSleepHours: () => DEFAULT_SLEEP_TARGET_HOURS - 2.5, // 5h
      sleepTargetHours: () => null,
      highEnergyBlocksFor: () => 1,
    }));
    expect(c).not.toBeNull();
    expect(c?.sleepDebtHours).toBeCloseTo(2.5, 2);
  });

  it('treats unknown sleep as zero debt (silent on that axis)', () => {
    expect(detectOvercommitment(DATE, deps({
      plannedMinutesForDate: () => 200,
      lastSleepHours: () => null,
      highEnergyBlocksFor: () => 2,
    }))).toBeNull();
  });
});

describe('detectOvercommitment — skip-rate signal', () => {
  it('fires when skip rate is high AND plan exceeds baseline', () => {
    const c = detectOvercommitment(DATE, deps({
      plannedMinutesForDate: () => 200, // slightly over 180, not over OVERLOAD_RATIO
      recentSkipRate: () => HIGH_SKIP_RATE + 0.05,
    }));
    expect(c).not.toBeNull();
    expect(c?.reasons.some((r) => r.toLowerCase().includes('skip'))).toBe(true);
  });

  it('stays silent on high skip rate when plan is within baseline', () => {
    expect(detectOvercommitment(DATE, deps({
      plannedMinutesForDate: () => 150, // under 180
      recentSkipRate: () => HIGH_SKIP_RATE + 0.1,
    }))).toBeNull();
  });
});

describe('detectOvercommitment — severity composition', () => {
  it('combines all three signals when they all fire', () => {
    const c = detectOvercommitment(DATE, deps({
      plannedMinutesForDate: () => 300, // 1.67x
      lastSleepHours: () => 5,           // 2.5h debt
      recentSkipRate: () => 0.4,
      highEnergyBlocksFor: () => 2,
    }));
    expect(c).not.toBeNull();
    expect(c!.reasons.length).toBe(3);
    expect(c!.severity).toBeGreaterThan(50);
    expect(c!.severity).toBeLessThanOrEqual(100);
  });

  it('caps severity at 100', () => {
    const c = detectOvercommitment(DATE, deps({
      plannedMinutesForDate: () => 1000, // wildly over
      lastSleepHours: () => 2,            // 5.5h debt — over cap
      recentSkipRate: () => 0.9,
      highEnergyBlocksFor: () => 5,
    }));
    expect(c?.severity).toBeLessThanOrEqual(100);
  });
});
