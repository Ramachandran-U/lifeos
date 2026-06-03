import { render, screen, fireEvent } from '@testing-library/react-native';

// Native AsyncStorage isn't linked under jest-expo; the store import chain pulls
// it in via the persist middleware. Use AsyncStorage's official in-memory jest mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { WhatNextCard } from '@/components/shared/WhatNextCard';
import { useUserStore } from '@/store/useUserStore';
import { useFlagStore } from '@/store/useFlagStore';
import type { UseWhatNextResult, WhatNextStatus } from '@/hooks/useWhatNext';

// The card only manages presentation; the agent + its state machine live in
// useWhatNext (unit-tested elsewhere). Mock the hook so we can drive each
// status branch deterministically.
const mockRun = jest.fn();
const mockReset = jest.fn();
// `mock`-prefixed so jest's mock factory may reference it (hoisting rule).
let mockHookState: UseWhatNextResult;

jest.mock('@/hooks/useWhatNext', () => ({
  useWhatNext: () => mockHookState,
}));

function setHook(status: WhatNextStatus, answer: string | null = null, error: string | null = null) {
  mockHookState = { status, answer, error, run: mockRun, reset: mockReset };
}

describe('WhatNextCard', () => {
  beforeEach(() => {
    setHook('idle');
    useUserStore.setState({ userId: 'user_fake_1' });
    useFlagStore.setState({ flags: { agent_what_next: true } });
  });

  afterEach(() => {
    useUserStore.getState().reset();
    useFlagStore.setState({ flags: {} });
    jest.clearAllMocks();
  });

  it('renders nothing when the agent_what_next flag is off', () => {
    useFlagStore.setState({ flags: { agent_what_next: false } });
    const { toJSON } = render(<WhatNextCard />);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when there is no signed-in user', () => {
    useUserStore.setState({ userId: null });
    const { toJSON } = render(<WhatNextCard />);
    expect(toJSON()).toBeNull();
  });

  it('shows the idle prompt and the primary CTA when idle', () => {
    setHook('idle');
    render(<WhatNextCard />);
    expect(screen.getByText('WHAT NOW')).toBeTruthy();
    expect(screen.getByText('What should I do next?')).toBeTruthy();
  });

  it('calls run() when the CTA is pressed', () => {
    setHook('idle');
    render(<WhatNextCard />);
    fireEvent.press(screen.getByText('What should I do next?'));
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it('shows the loading copy while loading', () => {
    setHook('loading');
    render(<WhatNextCard />);
    expect(screen.getByText('Reading your goals, routine and momentum…')).toBeTruthy();
  });

  it('renders the answer when done', () => {
    setHook('done', 'Spend 25 minutes on your finance review.');
    render(<WhatNextCard />);
    expect(screen.getByText('Spend 25 minutes on your finance review.')).toBeTruthy();
    expect(screen.getByText('Ask again')).toBeTruthy();
  });

  it('renders the error copy when errored', () => {
    setHook('error', null, 'Could not work that out right now.');
    render(<WhatNextCard />);
    expect(screen.getByText('Could not work that out right now.')).toBeTruthy();
  });

  it('falls back to a generic error message when error is null', () => {
    setHook('error', null, null);
    render(<WhatNextCard />);
    expect(screen.getByText('Something went wrong.')).toBeTruthy();
  });

  it('calls reset() when Dismiss is pressed after a result', () => {
    setHook('done', 'An answer.');
    render(<WhatNextCard />);
    fireEvent.press(screen.getByText('Dismiss'));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});
