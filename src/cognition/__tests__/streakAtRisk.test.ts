import {
  detectStreakAtRisk,
  daysBetweenForTest,
  MIN_STREAK_TO_PROTECT,
  LATE_HOUR,
  MAX_RECOVERABLE_GAP,
  type StreakAtRiskDeps,
} from '../streakAtRisk';

const TODAY = '2026-05-30';

function deps(over: Partial<StreakAtRiskDeps> = {}): StreakAtRiskDeps {
  return {
    streaks: { learning: { count: 10, lastDate: '2026-05-29' } }, // gap 1, alive
    today: TODAY,
    currentHour: LATE_HOUR,
    cooldownOk: () => true,
    ...over,
  };
}

describe('daysBetween', () => {
  it('counts whole days between YYYY-MM-DD dates', () => {
    expect(daysBetweenForTest('2026-05-29', '2026-05-30')).toBe(1);
    expect(daysBetweenForTest('2026-05-28', '2026-05-30')).toBe(2);
    expect(daysBetweenForTest('2026-05-30', '2026-05-30')).toBe(0);
  });
});

describe('detectStreakAtRisk — silent cases', () => {
  it('stays silent before the late-day hour', () => {
    expect(detectStreakAtRisk(deps({ currentHour: LATE_HOUR - 1 }))).toBeNull();
  });

  it('stays silent for streaks shorter than the protect threshold', () => {
    expect(
      detectStreakAtRisk(deps({ streaks: { learning: { count: MIN_STREAK_TO_PROTECT - 1, lastDate: '2026-05-29' } } })),
    ).toBeNull();
  });

  it('stays silent when the streak was already advanced today', () => {
    expect(detectStreakAtRisk(deps({ streaks: { learning: { count: 10, lastDate: TODAY } } }))).toBeNull();
  });

  it('stays silent when the streak has already lapsed (gap > max recoverable)', () => {
    expect(
      detectStreakAtRisk(deps({ streaks: { learning: { count: 10, lastDate: '2026-05-27' } } })), // gap 3
    ).toBeNull();
  });

  it('stays silent during cooldown', () => {
    expect(detectStreakAtRisk(deps({ cooldownOk: () => false }))).toBeNull();
  });
});

describe('detectStreakAtRisk — firing cases', () => {
  it('flags an alive streak not yet advanced today', () => {
    const c = detectStreakAtRisk(deps())!;
    expect(c).not.toBeNull();
    expect(c.streak).toBe('learning');
    expect(c.daysSinceLastAdvance).toBe(1);
    expect(c.reason).toMatch(/one action does it today/);
  });

  it('treats a 2-day gap as the urgent last chance (higher severity than 1-day)', () => {
    const oneDay = detectStreakAtRisk(deps({ streaks: { learning: { count: 10, lastDate: '2026-05-29' } } }))!;
    const twoDay = detectStreakAtRisk(deps({ streaks: { learning: { count: 10, lastDate: '2026-05-28' } } }))!;
    expect(twoDay.daysSinceLastAdvance).toBe(MAX_RECOVERABLE_GAP);
    expect(twoDay.reason).toMatch(/keeps it building/);
    expect(twoDay.severity).toBeGreaterThan(oneDay.severity);
  });

  it('returns the single highest-severity streak when several qualify', () => {
    const c = detectStreakAtRisk(
      deps({
        streaks: {
          journaling: { count: 4, lastDate: '2026-05-29' }, // gap 1
          workout: { count: 30, lastDate: '2026-05-29' }, // gap 1, much bigger
        },
      }),
    )!;
    expect(c.streak).toBe('workout');
  });
});

describe('detectStreakAtRisk — reason uses no loss-aversion framing (§11 red line #1)', () => {
  // Both the 1-day ("alive") and 2-day ("last chance") branches must read as
  // forward momentum, never streak-shaming. Guards against reintroducing
  // "don't lose" / "resets if you skip" / "keep it alive" copy.
  const LOSS_AVERSION_TERMS = [
    'lose', 'losing', 'at risk', "don't", 'dont', 'break your streak',
    'before midnight', 'midnight', 'reset', 'expire', 'alive', 'skip today',
    'shame', 'last chance', 'hurry',
  ];

  it.each([
    ['1-day gap', '2026-05-29'],
    ['2-day gap (last chance)', '2026-05-28'],
  ])('reason for a %s carries no loss-aversion phrasing', (_label, lastDate) => {
    const c = detectStreakAtRisk(deps({ streaks: { learning: { count: 10, lastDate } } }))!;
    expect(c).not.toBeNull();
    const lower = c.reason.toLowerCase();
    for (const term of LOSS_AVERSION_TERMS) {
      expect(lower).not.toContain(term);
    }
  });
});
