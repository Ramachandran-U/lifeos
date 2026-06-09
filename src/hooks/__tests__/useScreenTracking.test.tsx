/**
 * useScreenTracking logs a screen_view event with durationMs when the screen
 * blurs (useFocusEffect cleanup). Events shorter than 250ms are ignored.
 */
import { renderHook } from '@testing-library/react-native';
import { useScreenTracking } from '../useScreenTracking';

const mockLogBehaviourEvent = jest.fn();
jest.mock('@/db/queries/behaviour', () => ({
  logBehaviourEvent: (...args: unknown[]) => mockLogBehaviourEvent(...args),
}));

// useFocusEffect(cb) — call cb() immediately on mount; the returned cleanup
// runs on unmount, simulating the screen blur.
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    useFocusEffect: (cb: () => (() => void) | void) => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      useEffect(() => cb(), []);
    },
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('useScreenTracking', () => {
  it('calls logBehaviourEvent with screen_view and the screen name on unmount', () => {
    jest.setSystemTime(new Date('2026-06-09T10:00:00Z'));
    const { unmount } = renderHook(() => useScreenTracking('today'));

    // Advance 1 second so duration > 250ms
    jest.advanceTimersByTime(1000);
    unmount();

    expect(mockLogBehaviourEvent).toHaveBeenCalledWith(
      'screen_view',
      'today',
      expect.objectContaining({ durationMs: expect.any(Number) }),
    );
  });

  it('passes the correct durationMs (approximately)', () => {
    jest.setSystemTime(0);
    const { unmount } = renderHook(() => useScreenTracking('goals'));
    jest.advanceTimersByTime(5000);
    unmount();

    const call = mockLogBehaviourEvent.mock.calls[0];
    expect(call?.[2]?.durationMs).toBeGreaterThanOrEqual(4900);
  });

  it('skips logging when the duration is less than 250ms (accidental flash)', () => {
    jest.setSystemTime(0);
    const { unmount } = renderHook(() => useScreenTracking('health'));
    jest.advanceTimersByTime(100);
    unmount();

    expect(mockLogBehaviourEvent).not.toHaveBeenCalled();
  });

  it('logs events for different screen identifiers', () => {
    jest.setSystemTime(0);
    const { unmount: u1 } = renderHook(() => useScreenTracking('finance'));
    jest.advanceTimersByTime(500);
    u1();
    expect(mockLogBehaviourEvent).toHaveBeenCalledWith('screen_view', 'finance', expect.anything());
  });
});
