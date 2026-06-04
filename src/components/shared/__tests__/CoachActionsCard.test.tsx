import { render, screen, fireEvent } from '@testing-library/react-native';

// Native AsyncStorage isn't linked under jest-expo; the store import chain pulls
// it in via the persist middleware. Use AsyncStorage's official in-memory mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { CoachActionsCard } from '@/components/shared/CoachActionsCard';
import { useUserStore } from '@/store/useUserStore';
import { useFlagStore } from '@/store/useFlagStore';
import type {
  UseCoachActionsResult,
  CoachStatus,
  ProposalView,
} from '@/hooks/useCoachActions';
import type { ProposedAction } from '@/ai/agent/actionQueue';

// The card is presentation only; the agent + commit live in useCoachActions
// (its commit path delegates to the unit-tested actionQueue). Mock the hook so
// each status/proposal branch is deterministic.
const mockRun = jest.fn();
const mockReset = jest.fn();
const mockConfirm = jest.fn();
const mockDismiss = jest.fn();
let mockHookState: UseCoachActionsResult;

jest.mock('@/hooks/useCoachActions', () => ({
  useCoachActions: () => mockHookState,
}));

const ACTION: ProposedAction = {
  kind: 'createRoutineBlock',
  summary: 'Add "Focus session" (14:00–14:30, goal)',
  payload: { date: '2026-06-04', startTime: '14:00', endTime: '14:30', title: 'Focus session', module: 'goal' },
};

function setHook(
  status: CoachStatus,
  over: Partial<UseCoachActionsResult> = {},
): void {
  mockHookState = {
    status,
    answer: null,
    error: null,
    proposals: [],
    run: mockRun,
    reset: mockReset,
    confirm: mockConfirm,
    dismiss: mockDismiss,
    ...over,
  };
}

const prop = (state: ProposalView['state'], error?: string): ProposalView => ({
  action: ACTION,
  state,
  error,
});

describe('CoachActionsCard', () => {
  beforeEach(() => {
    setHook('idle');
    useUserStore.setState({ userId: 'user_fake_1' });
    useFlagStore.setState({ flags: { ai_coach_actions: true } });
  });

  afterEach(() => {
    useUserStore.getState().reset();
    useFlagStore.setState({ flags: {} });
    jest.clearAllMocks();
  });

  it('renders nothing when the ai_coach_actions flag is off', () => {
    useFlagStore.setState({ flags: { ai_coach_actions: false } });
    expect(render(<CoachActionsCard />).toJSON()).toBeNull();
  });

  it('renders nothing when there is no signed-in user', () => {
    useUserStore.setState({ userId: null });
    expect(render(<CoachActionsCard />).toJSON()).toBeNull();
  });

  it('shows the idle prompt and primary CTA when idle', () => {
    setHook('idle');
    render(<CoachActionsCard />);
    expect(screen.getByText('YOUR COACH')).toBeTruthy();
    expect(screen.getByText('What should I do next?')).toBeTruthy();
  });

  it('calls run() when the CTA is pressed', () => {
    setHook('idle');
    render(<CoachActionsCard />);
    fireEvent.press(screen.getByText('What should I do next?'));
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it('shows the loading copy while loading', () => {
    setHook('loading');
    render(<CoachActionsCard />);
    expect(screen.getByText('Reading your goals, routine and momentum…')).toBeTruthy();
  });

  it('renders the answer and a pending proposal with Confirm/Skip when done', () => {
    setHook('done', { answer: 'Start your focus block now.', proposals: [prop('pending')] });
    render(<CoachActionsCard />);
    expect(screen.getByText('Start your focus block now.')).toBeTruthy();
    expect(screen.getByText('Add "Focus session" (14:00–14:30, goal)')).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Skip')).toBeTruthy();
  });

  it('calls confirm(0) when a proposal is confirmed', () => {
    setHook('done', { answer: 'Do it.', proposals: [prop('pending')] });
    render(<CoachActionsCard />);
    fireEvent.press(screen.getByText('Confirm'));
    expect(mockConfirm).toHaveBeenCalledWith(0);
  });

  it('calls dismiss(0) when a proposal is skipped', () => {
    setHook('done', { answer: 'Do it.', proposals: [prop('pending')] });
    render(<CoachActionsCard />);
    fireEvent.press(screen.getByText('Skip'));
    expect(mockDismiss).toHaveBeenCalledWith(0);
  });

  it('hides a dismissed proposal', () => {
    setHook('done', { answer: 'Do it.', proposals: [prop('dismissed')] });
    render(<CoachActionsCard />);
    expect(screen.queryByText('Add "Focus session" (14:00–14:30, goal)')).toBeNull();
  });

  it('shows a failure message on a failed proposal and no Confirm button', () => {
    setHook('done', { answer: 'Do it.', proposals: [prop('failed', 'Block ref was stale')] });
    render(<CoachActionsCard />);
    expect(screen.getByText('Block ref was stale')).toBeTruthy();
    expect(screen.queryByText('Confirm')).toBeNull();
  });

  it('renders the error copy when errored, with a fallback', () => {
    setHook('error', { error: 'Proxy unavailable.' });
    render(<CoachActionsCard />);
    expect(screen.getByText('Proxy unavailable.')).toBeTruthy();

    setHook('error', { error: null });
    render(<CoachActionsCard />);
    expect(screen.getByText('Something went wrong.')).toBeTruthy();
  });

  it('calls reset() when Close is pressed after a result', () => {
    setHook('done', { answer: 'An answer.', proposals: [] });
    render(<CoachActionsCard />);
    fireEvent.press(screen.getByText('Close'));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});
