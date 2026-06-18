/**
 * Life hub redirect regression (the "open a domain → bounced to Today" bug).
 *
 * Root cause: the sheet conflated "picked a module" with "dismissed", so
 * picking fired the dismiss path (router.back / replace('/(tabs)')) which raced
 * — and beat — the navigation to the domain. The fix splits the two: a pick
 * calls onPick (parent navigates, suppresses the bounce); only a real dismiss
 * (scrim / back) calls onClose.
 *
 * These tests pin both halves: a pick navigates and never bounces (even after
 * the sheet's close timers elapse), and a dismiss still bounces to Today.
 */
import { render, screen, fireEvent, act } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => mockRouter,
    // Run the focus callback once on mount, its cleanup on unmount.
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, []),
  };
});

import { LifeHubSheet } from '@/components/shared/LifeHubSheet';
// The Life tab screen (app router file) — imported by relative path since the
// components jest project only globs src/**.
import LifeHubScreen from '../../../../app/(tabs)/life';

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe('LifeHubSheet — pick is not a dismiss', () => {
  it('picking a module calls onPick(route) and never onClose', () => {
    const onPick = jest.fn();
    const onClose = jest.fn();
    render(<LifeHubSheet visible onClose={onClose} onPick={onPick} />);

    fireEvent.press(screen.getByText('Health'));

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('/(tabs)/health');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Life hub redirect (regression)', () => {
  it('opening a domain navigates there and does NOT bounce back to Today', () => {
    jest.useFakeTimers();
    render(<LifeHubScreen />);

    fireEvent.press(screen.getByText('Finance'));

    expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/finance');
    // Flush the sheet's close-animation tail: the bounce must not fire on a pick.
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('dismissing without a pick still bounces back to Today', () => {
    jest.useFakeTimers();
    render(<LifeHubScreen />);

    fireEvent.press(screen.getByTestId('life-hub-scrim'));
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
