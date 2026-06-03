import {
  xpForLevel,
  levelFromXP,
  xpProgressInLevel,
  updateStreak,
  checkBadges,
  calculateDomainScore,
  bumpDomainScore,
  polymathScore,
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

// ─── Additional coverage: level curve edges ──────────────────────────────────

describe('xpForLevel — full documented curve', () => {
  it('matches the cumulative triangular thresholds for L1..L12', () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(2)).toBe(300);
    expect(xpForLevel(3)).toBe(600);
    expect(xpForLevel(4)).toBe(1000);
    expect(xpForLevel(5)).toBe(1500);
    expect(xpForLevel(6)).toBe(2100);
    expect(xpForLevel(7)).toBe(2800);
    expect(xpForLevel(8)).toBe(3600);
    expect(xpForLevel(9)).toBe(4500);
    expect(xpForLevel(10)).toBe(5500);
    expect(xpForLevel(11)).toBe(6600);
    expect(xpForLevel(12)).toBe(7800);
  });
  it('returns 0 for level 0 boundary', () => {
    expect(xpForLevel(0)).toBe(0);
  });
});

describe('levelFromXP — boundaries and level-up edges', () => {
  it('stays at level 1 for any XP below the L2 threshold', () => {
    expect(levelFromXP(0)).toBe(1);
    expect(levelFromXP(100)).toBe(1); // L1 threshold reached but L2 not
    expect(levelFromXP(299)).toBe(1);
  });
  it('advances exactly at each threshold and one below stays put', () => {
    expect(levelFromXP(300)).toBe(2);
    expect(levelFromXP(599)).toBe(2);
    expect(levelFromXP(600)).toBe(3);
    expect(levelFromXP(999)).toBe(3);
    expect(levelFromXP(1000)).toBe(4);
  });
  it('handles a large XP total at a high threshold boundary', () => {
    expect(levelFromXP(xpForLevel(12))).toBe(12);
    expect(levelFromXP(xpForLevel(12) - 1)).toBe(11);
  });
});

describe('xpProgressInLevel — level-1 anchor and level-up edge', () => {
  it('anchors level 1 at 0 so a fresh user sees 0/300', () => {
    const p = xpProgressInLevel(0);
    expect(p.level).toBe(1);
    expect(p.current).toBe(0);
    expect(p.needed).toBe(300); // xpForLevel(2)
    expect(p.pct).toBe(0);
  });
  it('reports partial progress inside level 1', () => {
    const p = xpProgressInLevel(150);
    expect(p.level).toBe(1);
    expect(p.current).toBe(150);
    expect(p.needed).toBe(300);
    expect(p.pct).toBeCloseTo(150 / 300);
  });
  it('resets current to 0 exactly at a level-up boundary', () => {
    // 300 XP → level 2, start anchored at xpForLevel(2)=300 → current 0
    const p = xpProgressInLevel(300);
    expect(p.level).toBe(2);
    expect(p.current).toBe(0);
    expect(p.needed).toBe(xpForLevel(3) - xpForLevel(2)); // 600-300 = 300
    expect(p.pct).toBe(0);
  });
  it('never yields a negative current and clamps pct into [0,1]', () => {
    const p = xpProgressInLevel(310);
    expect(p.current).toBeGreaterThanOrEqual(0);
    expect(p.pct).toBeGreaterThanOrEqual(0);
    expect(p.pct).toBeLessThanOrEqual(1);
  });
});

// ─── Additional coverage: bumpDomainScore clamps ─────────────────────────────

describe('bumpDomainScore', () => {
  it('applies a positive delta and rounds', () => {
    expect(bumpDomainScore(50, 12)).toBe(62);
    expect(bumpDomainScore(50, 2.6)).toBe(53);
  });
  it('applies a negative delta', () => {
    expect(bumpDomainScore(50, -20)).toBe(30);
  });
  it('clamps at the 100 ceiling', () => {
    expect(bumpDomainScore(95, 20)).toBe(100);
    expect(bumpDomainScore(100, 5)).toBe(100);
  });
  it('clamps at the 0 floor', () => {
    expect(bumpDomainScore(10, -40)).toBe(0);
    expect(bumpDomainScore(0, -5)).toBe(0);
  });
});

// ─── Additional coverage: polymathScore depth/breadth ────────────────────────

describe('polymathScore', () => {
  it('is 0 with no depth and no breadth', () => {
    expect(polymathScore(0, 0)).toBe(0);
  });
  it('is 100 at full depth and full breadth', () => {
    expect(polymathScore(12, 5)).toBe(100);
  });
  it('caps depth at the 12-salience-point ceiling', () => {
    // depth saturates → only the depth half (50) counts when breadth is 0
    expect(polymathScore(24, 0)).toBe(50);
    expect(polymathScore(12, 0)).toBe(50);
  });
  it('caps breadth at the 5-category ceiling', () => {
    expect(polymathScore(0, 10)).toBe(50);
    expect(polymathScore(0, 5)).toBe(50);
  });
  it('weights depth and breadth equally', () => {
    // depth 6/12 = 0.5, breadth 0 → 0.5*0.5*100 = 25
    expect(polymathScore(6, 0)).toBe(25);
    // depth 6/12 = 0.5, breadth 5/5 = 1 → (0.5*0.5 + 1*0.5)*100 = 75
    expect(polymathScore(6, 5)).toBe(75);
  });
});

// ─── Additional coverage: checkBadges remaining branches ─────────────────────

describe('checkBadges — single-flag awards', () => {
  it('awards first_blood_report on a completed blood report', () => {
    expect(checkBadges([], { completedBloodReport: true })).toEqual(['first_blood_report']);
  });
  it('awards goal_complete on a completed goal', () => {
    expect(checkBadges([], { completedGoal: true })).toEqual(['goal_complete']);
  });
  it('awards skill_mastery on completed skill mastery', () => {
    expect(checkBadges([], { completedSkillMastery: true })).toEqual(['skill_mastery']);
  });
  it('awards food_photo when the food photo feature is used', () => {
    expect(checkBadges([], { usedFoodPhoto: true })).toEqual(['food_photo']);
  });
  it('does not re-award any single-flag badge already earned', () => {
    expect(
      checkBadges(['first_blood_report', 'goal_complete', 'skill_mastery', 'food_photo'], {
        completedBloodReport: true,
        completedGoal: true,
        completedSkillMastery: true,
        usedFoodPhoto: true,
      }),
    ).toEqual([]);
  });
});

describe('checkBadges — week_1 consecutiveDays threshold', () => {
  it('does not award below 7 consecutive days', () => {
    expect(checkBadges([], { consecutiveDays: 6 })).not.toContain('week_1');
  });
  it('awards at exactly 7 consecutive days', () => {
    expect(checkBadges([], { consecutiveDays: 7 })).toContain('week_1');
  });
  it('awards above 7 consecutive days', () => {
    expect(checkBadges([], { consecutiveDays: 14 })).toContain('week_1');
  });
  it('does not re-award week_1 once earned', () => {
    expect(checkBadges(['week_1'], { consecutiveDays: 30 })).not.toContain('week_1');
  });
});

describe('checkBadges — streak_30_any threshold boundary', () => {
  const zeroStreaks = {
    workout: { count: 0, lastDate: '', graceUsed: false },
    learning: { count: 0, lastDate: '', graceUsed: false },
    foodTracking: { count: 0, lastDate: '', graceUsed: false },
    journaling: { count: 0, lastDate: '', graceUsed: false },
    social: { count: 0, lastDate: '', graceUsed: false },
  };
  it('does not award at 29-day streaks', () => {
    const streaks = { ...zeroStreaks, learning: { count: 29, lastDate: today(), graceUsed: false } };
    expect(checkBadges([], { streaks })).not.toContain('streak_30_any');
  });
  it('awards at exactly 30 on any single streak', () => {
    const streaks = { ...zeroStreaks, foodTracking: { count: 30, lastDate: today(), graceUsed: false } };
    expect(checkBadges([], { streaks })).toContain('streak_30_any');
  });
  it('does not re-award when already held', () => {
    const streaks = { ...zeroStreaks, social: { count: 45, lastDate: today(), graceUsed: false } };
    expect(checkBadges(['streak_30_any'], { streaks })).not.toContain('streak_30_any');
  });
});

describe('checkBadges — life_balance strict > 60 boundary', () => {
  it('does not award when one domain sits exactly at 60', () => {
    const domainScores = { goals: 61, health: 61, finance: 61, career: 61, social: 60, polymath: 61 };
    expect(checkBadges([], { domainScores })).not.toContain('life_balance');
  });
  it('awards when every domain is strictly above 60', () => {
    const domainScores = { goals: 61, health: 61, finance: 61, career: 61, social: 61, polymath: 61 };
    expect(checkBadges([], { domainScores })).toContain('life_balance');
  });
});

describe('checkBadges — multiple awards in one pass', () => {
  it('returns every newly-earned badge together', () => {
    const result = checkBadges([], {
      onboardingComplete: true,
      completedGoal: true,
      usedFoodPhoto: true,
    });
    expect(result).toEqual(expect.arrayContaining(['first_blueprint', 'goal_complete', 'food_photo']));
    expect(result).toHaveLength(3);
  });
  it('returns an empty array when context provides nothing', () => {
    expect(checkBadges([], {})).toEqual([]);
  });
});
