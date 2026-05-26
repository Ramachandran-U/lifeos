import {
  xpForLevel,
  levelFromXP,
  xpProgressInLevel,
  updateStreak,
  checkBadges,
  calculateDomainScore,
  XP_VALUES,
} from '../gamification';
import { format, subDays } from 'date-fns';

const today = () => format(new Date(), 'yyyy-MM-dd');
const daysAgo = (n: number) => format(subDays(new Date(), n), 'yyyy-MM-dd');

describe('xpForLevel', () => {
  it('returns the triangular XP thresholds', () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(2)).toBe(300);
    expect(xpForLevel(3)).toBe(600);
    expect(xpForLevel(10)).toBe(5500);
  });
});

describe('levelFromXP', () => {
  it('is level 1 at 0 XP', () => {
    expect(levelFromXP(0)).toBe(1);
  });
  it('advances at each threshold', () => {
    expect(levelFromXP(299)).toBe(1);
    expect(levelFromXP(300)).toBe(2);
    expect(levelFromXP(600)).toBe(3);
  });
});

describe('xpProgressInLevel', () => {
  it('reports percentage inside the current level', () => {
    const p = xpProgressInLevel(400);
    expect(p.level).toBe(2);
    expect(p.current).toBe(100);
    expect(p.needed).toBe(300);
    expect(p.pct).toBeCloseTo(100 / 300);
  });
  it('caps pct at 1', () => {
    const p = xpProgressInLevel(xpForLevel(5));
    expect(p.pct).toBeLessThanOrEqual(1);
  });
});

describe('updateStreak', () => {
  it('starts at 1 when there is no previous date', () => {
    const s = updateStreak({ count: 0, lastDate: '', graceUsed: false });
    expect(s.count).toBe(1);
    expect(s.lastDate).toBe(today());
  });
  it('is a no-op on same-day repeat', () => {
    const s = updateStreak({ count: 5, lastDate: today(), graceUsed: false });
    expect(s.count).toBe(5);
  });
  it('increments on consecutive day', () => {
    const s = updateStreak({ count: 3, lastDate: daysAgo(1), graceUsed: false });
    expect(s.count).toBe(4);
    expect(s.graceUsed).toBe(false);
  });
  it('uses grace on 2-day gap if unused', () => {
    const s = updateStreak({ count: 7, lastDate: daysAgo(2), graceUsed: false });
    expect(s.count).toBe(7);
    expect(s.graceUsed).toBe(true);
  });
  it('resets on 2-day gap if grace already used', () => {
    const s = updateStreak({ count: 7, lastDate: daysAgo(2), graceUsed: true });
    expect(s.count).toBe(1);
    expect(s.graceUsed).toBe(false);
  });
  it('resets on 3+ day gap', () => {
    const s = updateStreak({ count: 10, lastDate: daysAgo(3), graceUsed: false });
    expect(s.count).toBe(1);
  });
});

describe('checkBadges', () => {
  it('awards first_blueprint on onboarding complete', () => {
    const b = checkBadges([], { onboardingComplete: true });
    expect(b).toEqual(['first_blueprint']);
  });
  it('does not re-award an earned badge', () => {
    const b = checkBadges(['first_blueprint'], { onboardingComplete: true });
    expect(b).toEqual([]);
  });
  it('awards streak_30_any when any streak hits 30', () => {
    const streaks = {
      workout: { count: 30, lastDate: today(), graceUsed: false },
      learning: { count: 0, lastDate: '', graceUsed: false },
      foodTracking: { count: 0, lastDate: '', graceUsed: false },
      journaling: { count: 0, lastDate: '', graceUsed: false },
      social: { count: 0, lastDate: '', graceUsed: false },
    };
    const b = checkBadges([], { streaks });
    expect(b).toContain('streak_30_any');
  });
  it('awards life_balance only when all 6 domain scores > 60', () => {
    const domainScores = { goals: 70, health: 65, finance: 80, career: 90, social: 61, polymath: 75 };
    expect(checkBadges([], { domainScores })).toContain('life_balance');
    expect(checkBadges([], { domainScores: { ...domainScores, social: 60 } })).not.toContain('life_balance');
  });
  it('awards inner_orbit only when every inner-circle contact is in cadence', () => {
    expect(checkBadges([], { innerCircle: { total: 3, inCadence: 3 } })).toContain('inner_orbit');
    expect(checkBadges([], { innerCircle: { total: 3, inCadence: 2 } })).not.toContain('inner_orbit');
  });
  it('does not award inner_orbit when the inner circle is empty', () => {
    expect(checkBadges([], { innerCircle: { total: 0, inCadence: 0 } })).not.toContain('inner_orbit');
  });
});

describe('calculateDomainScore', () => {
  it('returns currentScore when there are no tasks today', () => {
    expect(calculateDomainScore(0, 0, 42)).toBe(42);
  });
  it('weights history 70% and today 30%', () => {
    // current=50, today=100/100 = 100 → 0.7*50 + 0.3*100 = 65
    expect(calculateDomainScore(5, 5, 50)).toBe(65);
  });
  it('clamps between 0 and 100', () => {
    expect(calculateDomainScore(10, 10, 100)).toBeLessThanOrEqual(100);
    expect(calculateDomainScore(0, 10, 0)).toBeGreaterThanOrEqual(0);
  });
});

describe('XP_VALUES', () => {
  it('has the documented reward tiers', () => {
    expect(XP_VALUES.completeBlock).toBe(10);
    expect(XP_VALUES.earnBadge).toBe(200);
    expect(XP_VALUES.completeResource).toBe(100);
  });
});
