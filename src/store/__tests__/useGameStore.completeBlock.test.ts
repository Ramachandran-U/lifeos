/**
 * Regression: routine-block completion XP accrual (QA double-credit fix).
 *
 * Before the fix, `completeBlock` credited XP AND every caller also called
 * `addXP(XP_VALUES.completeBlock)` — so a domain-module block awarded 2×.
 * Worse, `completeBlock` early-returned for non-domain modules (rest/meal/work),
 * so those got XP only from the caller's addXP. The fix makes `completeBlock`
 * the single XP source: it credits XP ONCE for every module (domain or not),
 * and only bumps a domain score when the module maps to one.
 */
import { useGameStore } from '../useGameStore';
import { XP_VALUES } from '@/utils/gamification';

// The store persists via the DB query layer on every action — mock it so the
// test exercises pure store logic without SQLite/localStorage.
jest.mock('@/db/queries/gamification', () => ({
  getOrCreateGamification: jest.fn(),
  updateGamification: jest.fn(),
}));
jest.mock('@/db/queries/users', () => ({ getUser: jest.fn(() => null) }));

import { updateGamification } from '@/db/queries/gamification';

const ZERO_SCORES = { goals: 0, health: 0, finance: 0, career: 0, social: 0, polymath: 0 };

function resetStore() {
  useGameStore.setState({
    domainScores: { ...ZERO_SCORES },
    streaks: {
      workout: { count: 0, lastDate: '', graceUsed: false },
      learning: { count: 0, lastDate: '', graceUsed: false },
      foodTracking: { count: 0, lastDate: '', graceUsed: false },
      journaling: { count: 0, lastDate: '', graceUsed: false },
      social: { count: 0, lastDate: '', graceUsed: false },
    },
    badges: [],
    totalXP: 0,
    weeklyXP: 0,
    pendingBadges: [],
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetStore();
});

describe('completeBlock — single XP credit (double-credit regression)', () => {
  it('credits XP exactly once for a domain module', () => {
    useGameStore.getState().completeBlock('u1', 'health', 1, 1);
    expect(useGameStore.getState().totalXP).toBe(XP_VALUES.completeBlock);
    expect(useGameStore.getState().weeklyXP).toBe(XP_VALUES.completeBlock);
  });

  it('credits XP for a NON-domain module (rest/meal/work), which previously earned 0 from completeBlock', () => {
    for (const mod of ['rest', 'meal', 'work']) {
      resetStore();
      useGameStore.getState().completeBlock('u1', mod, 1, 1);
      expect(useGameStore.getState().totalXP).toBe(XP_VALUES.completeBlock);
    }
  });

  it('moves a domain score only for a real domain, not for non-domain modules', () => {
    useGameStore.getState().completeBlock('u1', 'health', 1, 1);
    expect(useGameStore.getState().domainScores.health).toBeGreaterThan(0);

    resetStore();
    useGameStore.getState().completeBlock('u1', 'rest', 1, 1);
    // No domain key changed for a non-domain module.
    expect(useGameStore.getState().domainScores).toEqual(ZERO_SCORES);
  });

  it('persists the credited XP via updateGamification', () => {
    useGameStore.getState().completeBlock('u1', 'career', 1, 1);
    expect(updateGamification).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ totalXP: XP_VALUES.completeBlock, weeklyXP: XP_VALUES.completeBlock }),
    );
  });

  it('accumulates across multiple completions (no reset, no double)', () => {
    const { completeBlock } = useGameStore.getState();
    completeBlock('u1', 'health', 1, 1);
    completeBlock('u1', 'career', 1, 1);
    expect(useGameStore.getState().totalXP).toBe(XP_VALUES.completeBlock * 2);
  });
});
