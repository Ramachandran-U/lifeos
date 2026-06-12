/**
 * useGameStore — the rest of the store beyond the completeBlock regression:
 *   - triggerStreak  : fresh start, same-day no-op, +1 on consecutive day,
 *                      grace day, reset after a gap; persists + queues badges.
 *   - awardBadge      : dedup, pendingBadges queue, persist.
 *   - popBadge        : FIFO drain of pendingBadges.
 *   - completeGoalNode: domain bump (by goalType + level) + XP (daily vs higher).
 *   - addXP           : total vs weekly split + level-up detection.
 *
 * Mirrors useGameStore.completeBlock.test.ts: mock the DB query layer so the
 * test exercises pure store logic, and reset the store via setState before each.
 */
import { useGameStore } from '../useGameStore';
import { XP_VALUES, GOAL_LEVEL_BUMP, type Streaks } from '@/utils/gamification';
import { format, subDays } from 'date-fns';

jest.mock('@/db/queries/gamification', () => ({
  getOrCreateGamification: jest.fn(),
  updateGamification: jest.fn(),
}));
jest.mock('@/db/queries/users', () => ({ getUser: jest.fn(() => null) }));

import { updateGamification } from '@/db/queries/gamification';

const ZERO_SCORES = { goals: 0, health: 0, finance: 0, career: 0, social: 0, polymath: 0 };

function emptyStreaks(): Streaks {
  return {
    workout: { count: 0, lastDate: '', graceUsed: false },
    learning: { count: 0, lastDate: '', graceUsed: false },
    foodTracking: { count: 0, lastDate: '', graceUsed: false },
    journaling: { count: 0, lastDate: '', graceUsed: false },
    social: { count: 0, lastDate: '', graceUsed: false },
  };
}

function resetStore() {
  useGameStore.setState({
    domainScores: { ...ZERO_SCORES },
    streaks: emptyStreaks(),
    badges: [],
    totalXP: 0,
    weeklyXP: 0,
    pendingBadges: [],
    pendingLevelUp: null,
    lastKnownLevel: 1,
    // streak_protection_v1 defaults ON since 2026-06-14: earlier tests in the
    // file accrue freeze progress through grantXP — zero it between tests or
    // the freeze-bank assertions inherit leaked state.
    streakFreezes: 0,
    freezeProgressXP: 0,
  });
}

const dateNDaysAgo = (n: number) => format(subDays(new Date(), n), 'yyyy-MM-dd');

beforeEach(() => {
  jest.clearAllMocks();
  resetStore();
});

describe('triggerStreak', () => {
  it('starts a fresh streak at count 1 from a blank lastDate', () => {
    useGameStore.getState().triggerStreak('u1', 'workout');
    const s = useGameStore.getState().streaks.workout;
    expect(s.count).toBe(1);
    expect(s.lastDate).toBe(dateNDaysAgo(0));
  });

  it('is a no-op for a second trigger on the same day', () => {
    useGameStore.getState().triggerStreak('u1', 'learning');
    useGameStore.getState().triggerStreak('u1', 'learning');
    expect(useGameStore.getState().streaks.learning.count).toBe(1);
  });

  it('increments when the last trigger was yesterday', () => {
    useGameStore.setState({
      streaks: { ...emptyStreaks(), workout: { count: 4, lastDate: dateNDaysAgo(1), graceUsed: false } },
    });
    useGameStore.getState().triggerStreak('u1', 'workout');
    const s = useGameStore.getState().streaks.workout;
    expect(s.count).toBe(5);
    expect(s.lastDate).toBe(dateNDaysAgo(0));
  });

  it('uses the grace day (2-day gap) without resetting, marking graceUsed', () => {
    useGameStore.setState({
      streaks: { ...emptyStreaks(), social: { count: 9, lastDate: dateNDaysAgo(2), graceUsed: false } },
    });
    useGameStore.getState().triggerStreak('u1', 'social');
    const s = useGameStore.getState().streaks.social;
    expect(s.count).toBe(9);
    expect(s.graceUsed).toBe(true);
  });

  it('resets to 1 after a gap larger than the grace window', () => {
    useGameStore.setState({
      streaks: { ...emptyStreaks(), foodTracking: { count: 20, lastDate: dateNDaysAgo(5), graceUsed: false } },
    });
    useGameStore.getState().triggerStreak('u1', 'foodTracking');
    expect(useGameStore.getState().streaks.foodTracking.count).toBe(1);
  });

  it('persists the updated streaks via updateGamification', () => {
    useGameStore.getState().triggerStreak('u1', 'journaling');
    expect(updateGamification).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ streaks: expect.any(String) }),
    );
  });

  it('queues a streak_30_any badge when a streak crosses 30', () => {
    useGameStore.setState({
      streaks: { ...emptyStreaks(), workout: { count: 29, lastDate: dateNDaysAgo(1), graceUsed: false } },
    });
    useGameStore.getState().triggerStreak('u1', 'workout');
    expect(useGameStore.getState().streaks.workout.count).toBe(30);
    expect(useGameStore.getState().badges).toContain('streak_30_any');
    expect(useGameStore.getState().pendingBadges).toContain('streak_30_any');
  });
});

describe('awardBadge / popBadge', () => {
  it('adds a badge and queues it in pendingBadges', () => {
    useGameStore.getState().awardBadge('u1', 'first_connection');
    expect(useGameStore.getState().badges).toEqual(['first_connection']);
    expect(useGameStore.getState().pendingBadges).toEqual(['first_connection']);
    expect(updateGamification).toHaveBeenCalledWith(
      'u1',
      { badges: JSON.stringify(['first_connection']) },
    );
  });

  it('dedups an already-earned badge (no re-award, no re-queue, no persist)', () => {
    useGameStore.setState({ badges: ['first_connection'], pendingBadges: [] });
    useGameStore.getState().awardBadge('u1', 'first_connection');
    expect(useGameStore.getState().badges).toEqual(['first_connection']);
    expect(useGameStore.getState().pendingBadges).toEqual([]);
    expect(updateGamification).not.toHaveBeenCalled();
  });

  it('popBadge drains the queue FIFO and returns undefined when empty', () => {
    useGameStore.getState().awardBadge('u1', 'first_connection');
    useGameStore.getState().awardBadge('u1', 'food_photo');
    expect(useGameStore.getState().pendingBadges).toEqual(['first_connection', 'food_photo']);

    expect(useGameStore.getState().popBadge()).toBe('first_connection');
    expect(useGameStore.getState().popBadge()).toBe('food_photo');
    expect(useGameStore.getState().popBadge()).toBeUndefined();
    expect(useGameStore.getState().pendingBadges).toEqual([]);
  });
});

describe('completeGoalNode', () => {
  it('bumps the mapped domain by the level delta and credits task XP for a daily node', () => {
    useGameStore.setState({ domainScores: { ...ZERO_SCORES, career: 40 } });
    useGameStore.getState().completeGoalNode('u1', 'career', 'daily');
    expect(useGameStore.getState().domainScores.career).toBe(40 + GOAL_LEVEL_BUMP.daily);
    expect(useGameStore.getState().totalXP).toBe(XP_VALUES.completeGoalTask);
    expect(useGameStore.getState().weeklyXP).toBe(XP_VALUES.completeGoalTask);
  });

  it('maps an unknown goalType to the goals domain', () => {
    useGameStore.setState({ domainScores: { ...ZERO_SCORES, goals: 10 } });
    useGameStore.getState().completeGoalNode('u1', 'mystery', 'daily');
    expect(useGameStore.getState().domainScores.goals).toBe(10 + GOAL_LEVEL_BUMP.daily);
  });

  it('credits double XP and a larger bump for a higher-level node', () => {
    useGameStore.setState({ domainScores: { ...ZERO_SCORES, health: 20 } });
    useGameStore.getState().completeGoalNode('u1', 'health', 'monthly');
    expect(useGameStore.getState().totalXP).toBe(XP_VALUES.completeGoalTask * 2);
    expect(useGameStore.getState().domainScores.health).toBe(20 + GOAL_LEVEL_BUMP.monthly);
  });

  it("queues the goal_complete badge only when a 'life' node is finished", () => {
    useGameStore.getState().completeGoalNode('u1', 'personal', 'life');
    expect(useGameStore.getState().badges).toContain('goal_complete');
    expect(useGameStore.getState().pendingBadges).toContain('goal_complete');
  });

  it('does not award goal_complete for a sub-life node', () => {
    useGameStore.getState().completeGoalNode('u1', 'personal', 'weekly');
    expect(useGameStore.getState().badges).not.toContain('goal_complete');
  });

  it('persists the new scores + XP', () => {
    useGameStore.getState().completeGoalNode('u1', 'finance', 'yearly');
    expect(updateGamification).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        totalXP: XP_VALUES.completeGoalTask * 2,
        weeklyXP: XP_VALUES.completeGoalTask * 2,
      }),
    );
  });
});

describe('addXP', () => {
  it('adds the amount to both total and weekly XP', () => {
    useGameStore.setState({ totalXP: 30, weeklyXP: 12 });
    useGameStore.getState().addXP('u1', 25);
    expect(useGameStore.getState().totalXP).toBe(55);
    expect(useGameStore.getState().weeklyXP).toBe(37);
  });

  it('persists the XP fields plus the freeze bank (never streaks/badges)', () => {
    useGameStore.getState().addXP('u1', 10);
    // addXP routes through grantXP (Aurora Alive R0), which always persists
    // the freeze-accrual pair alongside the counters. streak_protection_v1
    // defaults ON since the 2026-06-14 rollout, so 10 XP accrues 10 of the
    // 200 XP a shield costs (no full shield yet).
    expect(updateGamification).toHaveBeenCalledWith('u1', {
      totalXP: 10,
      weeklyXP: 10,
      streakFreezes: 0,
      freezeProgressXP: 10,
    });
  });

  it('queues a pending level-up when the new total crosses a level boundary', () => {
    // L1 boundary is 100 cumulative XP; from 0, +150 crosses into L1→ (level 1
    // is the floor) — push enough to reach level 2 (>=300 cumulative).
    useGameStore.setState({ totalXP: 0, weeklyXP: 0, lastKnownLevel: 1 });
    useGameStore.getState().addXP('u1', 350);
    expect(useGameStore.getState().lastKnownLevel).toBeGreaterThan(1);
    expect(useGameStore.getState().pendingLevelUp).toBe(useGameStore.getState().lastKnownLevel);
  });

  it('does not set pendingLevelUp when the level is unchanged', () => {
    useGameStore.setState({ totalXP: 0, weeklyXP: 0, lastKnownLevel: 1, pendingLevelUp: null });
    useGameStore.getState().addXP('u1', 10);
    expect(useGameStore.getState().pendingLevelUp).toBeNull();
  });
});
