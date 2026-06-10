/**
 * useCompanionStore — identity persistence (the LWW companion JSON column),
 * the one-per-slot equip rule, and mood recompute over mocked data sources.
 */
import { useCompanionStore } from '../useCompanionStore';
import { useGameStore } from '../useGameStore';
import { COSMETICS } from '@/constants/cosmetics';

jest.mock('@/db/queries/gamification', () => ({
  getOrCreateGamification: jest.fn(),
  updateGamification: jest.fn(),
}));
jest.mock('@/db/queries/users', () => ({ getUser: jest.fn(() => null) }));
jest.mock('@/db/queries/routine', () => ({ getRoutineBlocksByDate: jest.fn(() => []) }));
jest.mock('@/db/queries/chests', () => ({
  getChestById: jest.fn(),
  getPendingChests: jest.fn(() => []),
  markChestOpened: jest.fn(),
  insertChest: jest.fn(),
  countChestsGrantedOnDay: jest.fn(() => 0),
}));
jest.mock('@/db/queries/cognitiveInsights', () => ({ getLatestInsight: jest.fn(() => undefined) }));

import { getOrCreateGamification, updateGamification } from '@/db/queries/gamification';
import { getRoutineBlocksByDate } from '@/db/queries/routine';
import { getPendingChests } from '@/db/queries/chests';

const mockGame = getOrCreateGamification as jest.Mock;
const mockUpdate = updateGamification as jest.Mock;
const mockBlocks = getRoutineBlocksByDate as jest.Mock;
const mockChests = getPendingChests as jest.Mock;

const AURA = COSMETICS.find((c) => c.slot === 'aura')!;
const AURA_2 = COSMETICS.filter((c) => c.slot === 'aura')[1]!;
const HAT = COSMETICS.find((c) => c.slot === 'headwear')!;

function gameRow(companion: string | null) {
  return { companion, cosmetics: '[]' };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGame.mockReturnValue(gameRow(null));
  mockBlocks.mockReturnValue([]);
  mockChests.mockReturnValue([]);
  useCompanionStore.setState({ mood: 'content', reason: 'x', identity: null });
  useGameStore.setState({
    streaks: {
      workout: { count: 0, lastDate: '', graceUsed: false },
      learning: { count: 0, lastDate: '', graceUsed: false },
      foodTracking: { count: 0, lastDate: '', graceUsed: false },
      journaling: { count: 0, lastDate: '', graceUsed: false },
      social: { count: 0, lastDate: '', graceUsed: false },
    },
    cosmetics: [AURA.id, AURA_2.id, HAT.id],
  });
});

describe('identity (name + equipped) — persisted, LWW-shaped', () => {
  test('setName persists the companion JSON and marks first-run naming', () => {
    useCompanionStore.getState().setName('u1', '  Lumen  ');
    const identity = useCompanionStore.getState().identity!;
    expect(identity.name).toBe('Lumen');
    expect(mockUpdate).toHaveBeenCalledWith('u1', { companion: expect.stringContaining('"Lumen"') });
  });

  test('empty names are rejected', () => {
    useCompanionStore.getState().setName('u1', '   ');
    expect(useCompanionStore.getState().identity).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('equip enforces one cosmetic per slot and keeps a sorted set', () => {
    useCompanionStore.getState().setName('u1', 'Lumen');
    useCompanionStore.getState().equip('u1', AURA.id);
    useCompanionStore.getState().equip('u1', HAT.id);
    // Second aura replaces the first; the hat survives.
    useCompanionStore.getState().equip('u1', AURA_2.id);
    const equipped = useCompanionStore.getState().identity!.equipped;
    expect(equipped).toContain(AURA_2.id);
    expect(equipped).toContain(HAT.id);
    expect(equipped).not.toContain(AURA.id);
    expect([...equipped].sort()).toEqual(equipped);
  });

  test('equipping an unowned cosmetic is a silent no-op', () => {
    useGameStore.setState({ cosmetics: [] });
    useCompanionStore.getState().setName('u1', 'Lumen');
    useCompanionStore.getState().equip('u1', AURA.id);
    expect(useCompanionStore.getState().identity!.equipped).toEqual([]);
  });

  test('unequip removes only the given id', () => {
    useCompanionStore.getState().setName('u1', 'Lumen');
    useCompanionStore.getState().equip('u1', AURA.id);
    useCompanionStore.getState().equip('u1', HAT.id);
    useCompanionStore.getState().unequip('u1', AURA.id);
    expect(useCompanionStore.getState().identity!.equipped).toEqual([HAT.id]);
  });
});

describe('recompute — derived mood over real-store adapters', () => {
  test('full completion derives thriving', async () => {
    mockBlocks.mockReturnValue([{ status: 'completed' }, { status: 'completed' }]);
    await useCompanionStore.getState().recompute('u1', new Date('2026-06-10T10:00:00'));
    expect(useCompanionStore.getState().mood).toBe('thriving');
  });

  test('pending chests derive curious', async () => {
    mockChests.mockReturnValue([{ id: 'c1' }]);
    await useCompanionStore.getState().recompute('u1', new Date('2026-06-10T10:00:00'));
    expect(useCompanionStore.getState().mood).toBe('curious');
  });

  test('quiet day derives content and hydrates identity from the row', async () => {
    mockGame.mockReturnValue(gameRow(JSON.stringify({ name: 'Pip', createdAt: 'x', equipped: [] })));
    await useCompanionStore.getState().recompute('u1', new Date('2026-06-10T10:00:00'));
    expect(useCompanionStore.getState().mood).toBe('content');
    expect(useCompanionStore.getState().identity?.name).toBe('Pip');
  });

  test('an evening streak-at-risk derives concerned', async () => {
    useGameStore.setState({
      streaks: {
        workout: { count: 6, lastDate: '2026-06-09', graceUsed: false },
        learning: { count: 0, lastDate: '', graceUsed: false },
        foodTracking: { count: 0, lastDate: '', graceUsed: false },
        journaling: { count: 0, lastDate: '', graceUsed: false },
        social: { count: 0, lastDate: '', graceUsed: false },
      },
    });
    // 19:00 local — past the detector's LATE_HOUR.
    await useCompanionStore.getState().recompute('u1', new Date('2026-06-10T19:00:00'));
    expect(useCompanionStore.getState().mood).toBe('concerned');
  });
});
