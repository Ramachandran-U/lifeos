import { render, screen, act } from '@testing-library/react-native';
import { StreakFlame } from '@/components/gamification/StreakFlame';

describe('StreakFlame', () => {
  it('renders the flame emoji and the initial count', () => {
    render(<StreakFlame count={7} />);
    expect(screen.getByText('🔥')).toBeTruthy();
    // Both the "old" and "new" number layers render the count on first paint.
    expect(screen.getAllByText('7').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the "grace" suffix when graceUsed is true', () => {
    render(<StreakFlame count={3} graceUsed />);
    expect(screen.getByText('grace')).toBeTruthy();
  });

  it('swaps the displayed number after the count changes (timer-driven)', () => {
    jest.useFakeTimers();
    try {
      const { rerender } = render(<StreakFlame count={4} />);
      rerender(<StreakFlame count={5} />);
      act(() => {
        jest.advanceTimersByTime(1200);
      });
      // After the swap timeout, the displayed (old) layer catches up to 5.
      expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1);
    } finally {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    }
  });

  it('renders at the small and large sizes', () => {
    expect(render(<StreakFlame count={2} size="sm" />).toJSON()).toBeTruthy();
    expect(render(<StreakFlame count={40} size="lg" />).toJSON()).toBeTruthy();
  });
});
