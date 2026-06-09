import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useComeback, EASE_BACK_QUEST } from '@/hooks/useComeback';
import { useFlagStore } from '@/store/useFlagStore';

jest.mock('@/utils/retention', () => ({
  detectComeback: jest.fn(),
  markComebackHandled: jest.fn(async () => undefined),
}));
jest.mock('@/gamification/chestGrants', () => ({ maybeGrantChest: jest.fn(() => 'chest-1') }));
jest.mock('@/db/queries/quests', () => ({
  insertQuest: jest.fn(() => 'q-1'),
  getQuestsByDay: jest.fn(() => []),
}));

import { detectComeback, markComebackHandled } from '@/utils/retention';
import { maybeGrantChest } from '@/gamification/chestGrants';
import { insertQuest, getQuestsByDay } from '@/db/queries/quests';

const mockDetect = detectComeback as jest.Mock;
const mockMark = markComebackHandled as jest.Mock;
const mockGrant = maybeGrantChest as jest.Mock;
const mockInsertQuest = insertQuest as jest.Mock;
const mockGetQuests = getQuestsByDay as jest.Mock;

function setFlags(comeback: boolean, quests: boolean) {
  useFlagStore.setState({ flags: { comeback_v1: comeback, quests_v2: quests } });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDetect.mockResolvedValue(null);
  mockGetQuests.mockReturnValue([]);
});

describe('useComeback', () => {
  it('does nothing while comeback_v1 is off', async () => {
    setFlags(false, true);
    const { result } = renderHook(() => useComeback('u1'));
    await waitFor(() => expect(result.current.days).toBeNull());
    expect(mockDetect).not.toHaveBeenCalled();
  });

  it('grants the chest + ease_back quest + marks handled on a real comeback', async () => {
    setFlags(true, true);
    mockDetect.mockResolvedValue(7);
    const { result } = renderHook(() => useComeback('u1'));
    await waitFor(() => expect(result.current.days).toBe(7));
    expect(mockGrant).toHaveBeenCalledWith('u1', 'comeback');
    expect(mockInsertQuest).toHaveBeenCalledWith(
      'u1',
      expect.any(String),
      EASE_BACK_QUEST,
      'template',
    );
    expect(mockMark).toHaveBeenCalled();
  });

  it('skips the quest when quests_v2 is off (a row nobody can see helps no one)', async () => {
    setFlags(true, false);
    mockDetect.mockResolvedValue(5);
    const { result } = renderHook(() => useComeback('u1'));
    await waitFor(() => expect(result.current.days).toBe(5));
    expect(mockInsertQuest).not.toHaveBeenCalled();
    expect(mockGrant).toHaveBeenCalled();
  });

  it('never double-inserts the ease_back quest for the same day', async () => {
    setFlags(true, true);
    mockDetect.mockResolvedValue(4);
    mockGetQuests.mockReturnValue([{ templateId: 'ease_back', status: 'active' }]);
    const { result } = renderHook(() => useComeback('u1'));
    await waitFor(() => expect(result.current.days).toBe(4));
    expect(mockInsertQuest).not.toHaveBeenCalled();
  });

  it('no comeback → sheet stays closed and nothing is granted', async () => {
    setFlags(true, true);
    mockDetect.mockResolvedValue(null);
    const { result } = renderHook(() => useComeback('u1'));
    await waitFor(() => expect(mockDetect).toHaveBeenCalled());
    expect(result.current.days).toBeNull();
    expect(mockGrant).not.toHaveBeenCalled();
    expect(mockMark).not.toHaveBeenCalled();
  });

  it('claim and dismiss both close the sheet', async () => {
    setFlags(true, true);
    mockDetect.mockResolvedValue(9);
    const { result } = renderHook(() => useComeback('u1'));
    await waitFor(() => expect(result.current.days).toBe(9));
    act(() => result.current.claim());
    expect(result.current.days).toBeNull();
  });
});
