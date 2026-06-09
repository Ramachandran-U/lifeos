import { maybeGrantChest } from '../chestGrants';
import { useFlagStore } from '@/store/useFlagStore';

jest.mock('@/db/queries/chests', () => ({
  insertChest: jest.fn(() => 'chest-1'),
  countChestsGrantedOnDay: jest.fn(() => 0),
}));

import { insertChest, countChestsGrantedOnDay } from '@/db/queries/chests';

const mockInsert = insertChest as jest.Mock;
const mockCount = countChestsGrantedOnDay as jest.Mock;

function setFlag(on: boolean) {
  useFlagStore.setState({ flags: { variable_rewards_v1: on } });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCount.mockReturnValue(0);
});

describe('maybeGrantChest — the flag-gated, capped grant gate', () => {
  test('no-op while variable_rewards_v1 is off (the default)', () => {
    setFlag(false);
    expect(maybeGrantChest('u1', 'peak_beat', '2026-06-10')).toBeNull();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test('grants once when the flag is on and nothing was granted today', () => {
    setFlag(true);
    expect(maybeGrantChest('u1', 'peak_beat', '2026-06-10')).toBe('chest-1');
    expect(mockInsert).toHaveBeenCalledWith('u1', 'peak_beat', '2026-06-10');
  });

  test('caps at one chest per local day across ALL sources', () => {
    setFlag(true);
    mockCount.mockReturnValue(1);
    expect(maybeGrantChest('u1', 'milestone', '2026-06-10')).toBeNull();
    expect(maybeGrantChest('u1', 'quest_sweep', '2026-06-10')).toBeNull();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test('re-entrant: a re-rendered peak moment cannot double-grant', () => {
    setFlag(true);
    mockCount.mockReturnValueOnce(0).mockReturnValue(1);
    expect(maybeGrantChest('u1', 'peak_beat', '2026-06-10')).toBe('chest-1');
    expect(maybeGrantChest('u1', 'peak_beat', '2026-06-10')).toBeNull();
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  test('missing userId → null (boot-time race safety)', () => {
    setFlag(true);
    expect(maybeGrantChest('', 'peak_beat', '2026-06-10')).toBeNull();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test('a storage throw is swallowed — granting never breaks the moment', () => {
    setFlag(true);
    mockCount.mockImplementation(() => {
      throw new Error('disk full');
    });
    expect(maybeGrantChest('u1', 'peak_beat', '2026-06-10')).toBeNull();
  });
});
