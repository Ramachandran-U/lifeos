/**
 * useChestStore.open — the single claim orchestrator: status guard, seeded
 * roll, sealed persistence, and the apply paths (XP through grantXP, freeze
 * via addFreeze, cosmetic via addCosmetic). DB layer mocked like the other
 * store suites; the lootTable runs for real (it's pure), with seeds chosen by
 * scanning for each outcome type so the test stays deterministic.
 */
import { useChestStore } from '../useChestStore';
import { useGameStore } from '../useGameStore';
import { rollLoot } from '@/gamification/lootTable';
import type { ChestRecord } from '@/db/queries/chests';

jest.mock('@/db/queries/gamification', () => ({
  getOrCreateGamification: jest.fn(),
  updateGamification: jest.fn(),
}));
jest.mock('@/db/queries/users', () => ({ getUser: jest.fn(() => null) }));
jest.mock('@/db/queries/chests', () => ({
  getChestById: jest.fn(),
  getPendingChests: jest.fn(() => []),
  markChestOpened: jest.fn(),
}));

import { getChestById, markChestOpened } from '@/db/queries/chests';

const mockGetChest = getChestById as jest.Mock;
const mockMarkOpened = markChestOpened as jest.Mock;

/** Scan for a seed whose (fresh-context) roll is the wanted type. */
function seedFor(type: 'xp' | 'freeze' | 'cosmetic'): string {
  for (let i = 0; i < 5_000; i++) {
    const seed = `scan-${type}-${i}`;
    if (rollLoot(seed, { freezesBanked: 0, ownedCosmetics: [] }).type === type) return seed;
  }
  throw new Error(`no ${type} seed found in 5000 tries`);
}

function pendingChest(seed: string, over: Partial<ChestRecord> = {}): ChestRecord {
  return {
    id: 'c1',
    userId: 'u1',
    source: 'peak_beat',
    status: 'pending',
    seed,
    contents: null,
    dayLocal: '2026-06-10',
    grantedAt: '2026-06-10T18:00:00.000Z',
    claimedAt: null,
    createdAt: '2026-06-10T18:00:00.000Z',
    updatedAt: '2026-06-10T18:00:00.000Z',
    deletedAt: null,
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useGameStore.setState({
    totalXP: 0,
    weeklyXP: 0,
    streakFreezes: 0,
    freezeProgressXP: 0,
    cosmetics: [],
    pendingLevelUp: null,
    lastKnownLevel: 1,
  });
  useChestStore.setState({ pending: [], lastOpened: null });
});

describe('useChestStore.open', () => {
  test('XP drop routes through grantXP (counters move) and seals the row', () => {
    const seed = seedFor('xp');
    const expected = rollLoot(seed, { freezesBanked: 0, ownedCosmetics: [] });
    mockGetChest.mockReturnValue(pendingChest(seed));

    const contents = useChestStore.getState().open('u1', 'c1');

    expect(contents).toEqual(expected);
    expect(mockMarkOpened).toHaveBeenCalledWith('c1', expected);
    expect(useGameStore.getState().totalXP).toBe(expected.type === 'xp' ? expected.amount : -1);
    expect(useChestStore.getState().lastOpened?.contents).toEqual(expected);
  });

  test('freeze drop banks one shield (LWW counter, clamped)', () => {
    const seed = seedFor('freeze');
    mockGetChest.mockReturnValue(pendingChest(seed));

    const contents = useChestStore.getState().open('u1', 'c1');

    expect(contents).toEqual({ type: 'freeze' });
    expect(useGameStore.getState().streakFreezes).toBe(1);
    expect(useGameStore.getState().totalXP).toBe(0); // freezes never touch XP
  });

  test('cosmetic drop lands in the sorted owned set', () => {
    const seed = seedFor('cosmetic');
    mockGetChest.mockReturnValue(pendingChest(seed));

    const contents = useChestStore.getState().open('u1', 'c1');

    expect(contents?.type).toBe('cosmetic');
    const owned = useGameStore.getState().cosmetics;
    expect(owned).toHaveLength(1);
    expect([...owned].sort()).toEqual(owned);
  });

  test('idempotent: an already-opened chest returns null and rolls nothing', () => {
    mockGetChest.mockReturnValue(pendingChest(seedFor('xp'), { status: 'opened' }));
    expect(useChestStore.getState().open('u1', 'c1')).toBeNull();
    expect(mockMarkOpened).not.toHaveBeenCalled();
    expect(useGameStore.getState().totalXP).toBe(0);
  });

  test('missing chest returns null', () => {
    mockGetChest.mockReturnValue(undefined);
    expect(useChestStore.getState().open('u1', 'nope')).toBeNull();
  });
});
