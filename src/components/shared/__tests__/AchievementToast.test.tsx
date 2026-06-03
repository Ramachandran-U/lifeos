import { render, screen, act } from '@testing-library/react-native';

// Native AsyncStorage isn't linked under jest-expo; the store import chain pulls
// it in via the persist middleware. Use AsyncStorage's official in-memory jest mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { AchievementToast } from '@/components/shared/AchievementToast';
import { useGameStore } from '@/store/useGameStore';
import { XP_VALUES } from '@/utils/gamification';

// Avoid the native haptics module asserting in the node-ish render env.
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success' },
}));

describe('AchievementToast', () => {
  afterEach(() => {
    useGameStore.setState({ pendingBadges: [] });
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('renders nothing when there are no pending badges', () => {
    useGameStore.setState({ pendingBadges: [] });
    const { toJSON } = render(<AchievementToast />);
    expect(toJSON()).toBeNull();
  });

  it('shows the queued badge name, subtitle and +XP', () => {
    useGameStore.setState({ pendingBadges: ['first_blueprint'] });
    render(<AchievementToast />);
    expect(screen.getByText('First Blueprint')).toBeTruthy();
    expect(screen.getByText('You built your first daily routine')).toBeTruthy();
    expect(screen.getByText(`+${XP_VALUES.earnBadge} XP`)).toBeTruthy();
  });

  it('pops the badge off the pending queue when shown', () => {
    useGameStore.setState({ pendingBadges: ['goal_complete'] });
    render(<AchievementToast />);
    expect(useGameStore.getState().pendingBadges).toEqual([]);
  });

  it('auto-dismisses after 4 seconds', () => {
    jest.useFakeTimers();
    useGameStore.setState({ pendingBadges: ['skill_mastery'] });
    render(<AchievementToast />);
    expect(screen.getByText('Skill Mastery')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(4000);
    });

    expect(screen.queryByText('Skill Mastery')).toBeNull();
  });

  it('stays visible before the dismiss timer elapses', () => {
    jest.useFakeTimers();
    useGameStore.setState({ pendingBadges: ['week_1'] });
    render(<AchievementToast />);

    act(() => {
      jest.advanceTimersByTime(3000); // < 4000
    });

    expect(screen.getByText('One Week Strong')).toBeTruthy();
  });
});
