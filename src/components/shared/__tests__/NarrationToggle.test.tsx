import { render, screen, fireEvent } from '@testing-library/react-native';

// Native AsyncStorage isn't linked under jest-expo; the store import chain pulls
// it in via the persist middleware. Use AsyncStorage's official in-memory jest mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { NarrationToggle } from '@/components/shared/NarrationToggle';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import type { UseOnboardingNarrationResult } from '@/hooks/useOnboardingNarration';

// The hook owns the expo-speech plumbing + asset availability; we only need to
// drive its return value to exercise the toggle's branches.
const mockToggle = jest.fn().mockResolvedValue(undefined);
const mockStop = jest.fn().mockResolvedValue(undefined);
// `mock`-prefixed so jest's mock factory may reference it (hoisting rule).
let mockNarration: UseOnboardingNarrationResult;

jest.mock('@/hooks/useOnboardingNarration', () => ({
  useOnboardingNarration: () => mockNarration,
}));

function setNarration(isAvailable: boolean, isPlaying = false) {
  mockNarration = { isAvailable, isPlaying, toggle: mockToggle, stop: mockStop };
}

describe('NarrationToggle', () => {
  beforeEach(() => {
    usePreferencesStore.setState({ narrationEnabled: true });
  });

  afterEach(() => {
    usePreferencesStore.setState({ narrationEnabled: true });
    jest.clearAllMocks();
  });

  it('renders nothing when no narration asset is available', () => {
    setNarration(false);
    const { toJSON } = render(<NarrationToggle scriptId="day1-vision" />);
    expect(toJSON()).toBeNull();
  });

  it('shows the "Replay" affordance when enabled and idle', () => {
    setNarration(true, false);
    usePreferencesStore.setState({ narrationEnabled: true });
    render(<NarrationToggle scriptId="day1-vision" />);
    expect(screen.getByText('Replay')).toBeTruthy();
  });

  it('shows "Speaking…" while playing', () => {
    setNarration(true, true);
    usePreferencesStore.setState({ narrationEnabled: true });
    render(<NarrationToggle scriptId="day1-vision" />);
    expect(screen.getByText('Speaking…')).toBeTruthy();
  });

  it('prompts to enable voice when narration preference is off', () => {
    setNarration(true, false);
    usePreferencesStore.setState({ narrationEnabled: false });
    render(<NarrationToggle scriptId="day1-vision" />);
    expect(screen.getByText('Tap to enable voice')).toBeTruthy();
  });

  it('enables the narration preference (without toggling playback) when off and pressed', () => {
    setNarration(true, false);
    usePreferencesStore.setState({ narrationEnabled: false });
    render(<NarrationToggle scriptId="day1-vision" />);

    fireEvent.press(screen.getByTestId('narration-toggle-day1-vision'));

    expect(usePreferencesStore.getState().narrationEnabled).toBe(true);
    expect(mockToggle).not.toHaveBeenCalled();
  });

  it('toggles playback when enabled and pressed', () => {
    setNarration(true, false);
    usePreferencesStore.setState({ narrationEnabled: true });
    render(<NarrationToggle scriptId="day1-vision" />);

    fireEvent.press(screen.getByTestId('narration-toggle-day1-vision'));

    expect(mockToggle).toHaveBeenCalledTimes(1);
  });
});
