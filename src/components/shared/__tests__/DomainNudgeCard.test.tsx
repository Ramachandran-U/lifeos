import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

// The card reads useUserStore / useDomainHistoryStore via getState(); those
// stores persist through AsyncStorage, unlinked under jest-expo. In-memory mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Detector + suggestion builder live in @/cognition; mock them so the async
// effect resolves to a deterministic stagnant-domain candidate + suggestions
// without any real history math.
const mockDetect = jest.fn();
const mockBuildSuggestions = jest.fn();
jest.mock('@/cognition/domainStagnation', () => ({
  detectStagnantDomain: (...args: unknown[]) => mockDetect(...args),
  domainToModule: (d: string) => d,
}));
jest.mock('@/cognition/domainSuggestions', () => ({
  buildDomainSuggestions: (...args: unknown[]) => mockBuildSuggestions(...args),
}));

// Storage read boundaries.
jest.mock('@/db/queries/goals', () => ({ getGoalsByUser: () => [] }));
const mockCreateRoutineBlocks = jest.fn();
jest.mock('@/db/queries/routine', () => ({
  getRoutineBlocksByDate: () => [],
  createRoutineBlocks: (...args: unknown[]) => mockCreateRoutineBlocks(...args),
}));
jest.mock('@/db/queries/behaviour', () => ({ getEventsLastNDays: () => [] }));

const mockRecordInsight = jest.fn((..._args: unknown[]) => 'insight_fake_1');
const mockUpdateInsightStatus = jest.fn();
jest.mock('@/db/queries/cognitiveInsights', () => ({
  recordInsight: (...args: unknown[]) => mockRecordInsight(...args),
  updateInsightStatus: (...args: unknown[]) => mockUpdateInsightStatus(...args),
  isInsightCooldownOk: () => true,
}));

import { DomainNudgeCard } from '@/components/shared/DomainNudgeCard';
import { setFlagOverride, resetFlagOverrides } from '@/config/flags';

const candidate = { domain: 'finance', daysFlat: 9, delta: 0, currentScore: 40 };
const suggestions = [
  { title: 'Review last week\'s spending', module: 'finance', durationMin: 15, source: 'goal', goalId: 'goal_fake_1' },
  { title: 'Set a savings micro-goal', module: 'finance', durationMin: 20, source: 'template', goalId: null },
];

describe('DomainNudgeCard', () => {
  beforeEach(() => {
    mockDetect.mockReturnValue(candidate);
    mockBuildSuggestions.mockResolvedValue(suggestions);
    setFlagOverride({ domainNudges: true, domainNudgesVisible: true });
  });

  afterEach(() => {
    resetFlagOverrides();
    jest.clearAllMocks();
  });

  it('renders nothing while the domainNudgesVisible flag is off', () => {
    setFlagOverride({ domainNudgesVisible: false });
    const { toJSON } = render(<DomainNudgeCard userId="user_fake_1" tomorrow="2026-06-05" />);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when the detector finds no stagnant domain', () => {
    mockDetect.mockReturnValue(null);
    const { toJSON } = render(<DomainNudgeCard userId="user_fake_1" tomorrow="2026-06-05" />);
    expect(toJSON()).toBeNull();
  });

  it('renders the growth nudge with the domain label, days flat and suggestions', async () => {
    render(<DomainNudgeCard userId="user_fake_1" tomorrow="2026-06-05" />);
    await waitFor(() => {
      expect(screen.getByText('GROWTH NUDGE')).toBeTruthy();
    });
    expect(screen.getByText(/hasn't moved in 9 days/)).toBeTruthy();
    expect(screen.getByText("Review last week's spending")).toBeTruthy();
    expect(screen.getByText('Set a savings micro-goal')).toBeTruthy();
  });

  it('adds a block via the platform-aware createRoutineBlocks and confirms on accept (D8)', async () => {
    render(<DomainNudgeCard userId="user_fake_1" tomorrow="2026-06-05" />);
    await waitFor(() => screen.getByText("Review last week's spending"));

    fireEvent.press(screen.getByText("Review last week's spending"));

    // D8: writes via createRoutineBlocks (web localStorage / native SQLite, and
    // records a mutation) — NOT the web-only shim that silently no-ops on native.
    expect(mockCreateRoutineBlocks).toHaveBeenCalledTimes(1);
    expect(mockCreateRoutineBlocks.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        date: '2026-06-05',
        title: "Review last week's spending",
        module: 'finance',
        linkedEntityId: 'goal_fake_1',
        startTime: '18:00',
        endTime: '18:15', // 18:00 + 15-min suggestion duration
      }),
    ]);
    expect(mockUpdateInsightStatus).toHaveBeenCalledWith('insight_fake_1', 'accepted');
    await waitFor(() => {
      expect(screen.getByText("Added to tomorrow's plan.")).toBeTruthy();
    });
  });

  it('dismisses (and hides) the card on "Not now"', async () => {
    render(<DomainNudgeCard userId="user_fake_1" tomorrow="2026-06-05" />);
    await waitFor(() => screen.getByText('Not now'));

    fireEvent.press(screen.getByText('Not now'));

    expect(mockUpdateInsightStatus).toHaveBeenCalledWith('insight_fake_1', 'dismissed');
    expect(screen.queryByText('GROWTH NUDGE')).toBeNull();
  });
});
