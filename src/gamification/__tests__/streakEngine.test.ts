import {
  advanceStreak,
  restoreFromLoss,
  markMilestoneCelebrated,
  accrueFreezeProgress,
  FREEZE_EARN_XP,
  MAX_FREEZES_BANKED,
  MILESTONE_TIERS,
} from '../streakEngine';
import type { StreakData } from '@/utils/gamification';

const base = (overrides: Partial<StreakData> = {}): StreakData => ({
  count: 5,
  lastDate: '2026-06-01',
  graceUsed: false,
  ...overrides,
});

describe('advanceStreak — legacy ladder preserved (no freezes offered)', () => {
  it('first ever activity starts at 1', () => {
    const r = advanceStreak(
      { count: 0, lastDate: '', graceUsed: false },
      { today: '2026-06-10', freezesAvailable: 0 },
    );
    expect(r.next.count).toBe(1);
    expect(r.lost).toBe(false);
    expect(r.freezeConsumed).toBe(false);
  });

  it('same day is a no-op', () => {
    const s = base({ lastDate: '2026-06-10' });
    const r = advanceStreak(s, { today: '2026-06-10', freezesAvailable: 2 });
    expect(r.next).toBe(s);
    expect(r.milestoneCrossed).toBeNull();
  });

  it('gap 1 increments and clears grace', () => {
    const r = advanceStreak(base({ graceUsed: true }), { today: '2026-06-02', freezesAvailable: 0 });
    expect(r.next).toMatchObject({ count: 6, lastDate: '2026-06-02', graceUsed: false });
  });

  it('gap 2 with free grace preserves count and consumes grace (no increment)', () => {
    const r = advanceStreak(base(), { today: '2026-06-03', freezesAvailable: 0 });
    expect(r.next).toMatchObject({ count: 5, graceUsed: true, lastDate: '2026-06-03' });
    expect(r.freezeConsumed).toBe(false);
    expect(r.lost).toBe(false);
  });

  it('gap 2 with grace already used and no freeze → genuine loss, reset to 1', () => {
    const r = advanceStreak(base({ graceUsed: true }), { today: '2026-06-03', freezesAvailable: 0 });
    expect(r.next.count).toBe(1);
    expect(r.lost).toBe(true);
    expect(r.next.lastLoss).toEqual({ count: 5, date: '2026-06-03' });
  });

  it('gap 3 with no freeze → loss', () => {
    const r = advanceStreak(base(), { today: '2026-06-04', freezesAvailable: 0 });
    expect(r.lost).toBe(true);
    expect(r.next.count).toBe(1);
  });
});

describe('advanceStreak — freeze rescues', () => {
  it('gap 2 with grace used but a freeze banked → freeze consumed, count + 1', () => {
    const r = advanceStreak(base({ graceUsed: true }), { today: '2026-06-03', freezesAvailable: 1 });
    expect(r.freezeConsumed).toBe(true);
    expect(r.lost).toBe(false);
    expect(r.next.count).toBe(6);
    expect(r.next.lastLoss).toBeNull();
  });

  it('gap 4 with a freeze → rescued', () => {
    const r = advanceStreak(base(), { today: '2026-06-05', freezesAvailable: 2 });
    expect(r.freezeConsumed).toBe(true);
    expect(r.next.count).toBe(6);
  });

  it('gap 5 is beyond what a freeze bridges → loss even with freezes banked', () => {
    const r = advanceStreak(base(), { today: '2026-06-06', freezesAvailable: 2 });
    expect(r.freezeConsumed).toBe(false);
    expect(r.lost).toBe(true);
  });

  it('best high-water mark survives a loss', () => {
    const r = advanceStreak(base({ count: 12, best: 12 }), { today: '2026-06-08', freezesAvailable: 0 });
    expect(r.lost).toBe(true);
    expect(r.next.best).toBe(12);
    expect(r.next.count).toBe(1);
  });
});

describe('advanceStreak — milestone tiers', () => {
  it.each([
    [6, 7],
    [29, 30],
    [99, 100],
    [364, 365],
  ])('crossing %i → %i fires that tier', (from, tier) => {
    const r = advanceStreak(base({ count: from, lastDate: '2026-06-01' }), {
      today: '2026-06-02',
      freezesAvailable: 0,
    });
    expect(r.milestoneCrossed).toBe(tier);
  });

  it('an already-celebrated tier never re-fires', () => {
    const r = advanceStreak(base({ count: 6, milestones: [7] }), {
      today: '2026-06-02',
      freezesAvailable: 0,
    });
    expect(r.next.count).toBe(7);
    expect(r.milestoneCrossed).toBeNull();
  });

  it('non-boundary advances fire nothing', () => {
    const r = advanceStreak(base({ count: 10 }), { today: '2026-06-02', freezesAvailable: 0 });
    expect(r.milestoneCrossed).toBeNull();
  });

  it('a freeze rescue that lands on a tier still celebrates it', () => {
    const r = advanceStreak(base({ count: 6, graceUsed: true }), {
      today: '2026-06-03',
      freezesAvailable: 1,
    });
    expect(r.freezeConsumed).toBe(true);
    expect(r.milestoneCrossed).toBe(7);
  });
});

describe('restoreFromLoss — 24h recovery window', () => {
  const lost = base({ count: 1, lastDate: '2026-06-08', lastLoss: { count: 12, date: '2026-06-08' } });

  it('same day → restored to lostCount + 1', () => {
    const r = restoreFromLoss(lost, '2026-06-08');
    expect(r).toMatchObject({ count: 13, lastDate: '2026-06-08', lastLoss: null });
    expect(r?.best).toBe(13);
  });

  it('next day → still restorable', () => {
    expect(restoreFromLoss(lost, '2026-06-09')?.count).toBe(13);
  });

  it('two days later → window closed', () => {
    expect(restoreFromLoss(lost, '2026-06-10')).toBeNull();
  });

  it('nothing to restore → null', () => {
    expect(restoreFromLoss(base({ lastLoss: null }), '2026-06-08')).toBeNull();
    expect(restoreFromLoss(base(), '2026-06-08')).toBeNull();
  });
});

describe('markMilestoneCelebrated', () => {
  it('records the tier once, sorted', () => {
    const s = markMilestoneCelebrated(base({ milestones: [30] }), 7);
    expect(s.milestones).toEqual([7, 30]);
    expect(markMilestoneCelebrated(s, 7)).toBe(s); // idempotent
  });
});

describe('accrueFreezeProgress — earned shields', () => {
  it('accumulates below the threshold without earning', () => {
    expect(accrueFreezeProgress(50, 0, 100)).toEqual({
      freezeProgressXP: 150, streakFreezes: 0, freezesEarned: 0,
    });
  });

  it('crossing the threshold earns one freeze and rolls the remainder', () => {
    expect(accrueFreezeProgress(150, 0, 100)).toEqual({
      freezeProgressXP: 50, streakFreezes: 1, freezesEarned: 1,
    });
  });

  it('a huge grant can earn multiple freezes up to the bank cap', () => {
    const r = accrueFreezeProgress(0, 0, FREEZE_EARN_XP * 5);
    expect(r.streakFreezes).toBe(MAX_FREEZES_BANKED);
    expect(r.freezesEarned).toBe(MAX_FREEZES_BANKED);
    // Held progress caps at one freeze's worth — effort held, not lost.
    expect(r.freezeProgressXP).toBeLessThanOrEqual(FREEZE_EARN_XP);
  });

  it('bank full → progress holds at the cap so a spent freeze re-earns instantly', () => {
    const full = accrueFreezeProgress(FREEZE_EARN_XP, MAX_FREEZES_BANKED, 50);
    expect(full.streakFreezes).toBe(MAX_FREEZES_BANKED);
    expect(full.freezesEarned).toBe(0);
    expect(full.freezeProgressXP).toBe(FREEZE_EARN_XP);
    // Spend one, then any grant converts the held progress into a new shield.
    const after = accrueFreezeProgress(full.freezeProgressXP, MAX_FREEZES_BANKED - 1, 1);
    expect(after.streakFreezes).toBe(MAX_FREEZES_BANKED);
    expect(after.freezesEarned).toBe(1);
  });
});

describe('tier table sanity', () => {
  it('tiers are the published ladder', () => {
    expect([...MILESTONE_TIERS]).toEqual([7, 30, 100, 365]);
  });
});
