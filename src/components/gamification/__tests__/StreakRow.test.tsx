import { render, screen } from '@testing-library/react-native';
import { StreakRow } from '@/components/gamification/StreakRow';
import { STREAK_META } from '@/constants/gamification';

describe('StreakRow', () => {
  it('renders the streak label, current and best counts', () => {
    render(<StreakRow streakKey="workout" count={5} best={12} graceUsed={false} />);
    expect(screen.getByText(STREAK_META.workout.label)).toBeTruthy();
    // The current count appears in both the "Now:" stat and the flame layers.
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('renders the "days to 30-day badge" copy from the current count', () => {
    render(<StreakRow streakKey="learning" count={8} best={8} graceUsed={false} />);
    expect(screen.getByText('22 days to 30-day badge')).toBeTruthy();
  });

  it('clamps the days-to-badge copy to 0 once the count reaches 30', () => {
    render(<StreakRow streakKey="learning" count={35} best={35} graceUsed={false} />);
    expect(screen.getByText('0 days to 30-day badge')).toBeTruthy();
  });

  it('shows the GRACE pill only when grace was used', () => {
    const { rerender } = render(<StreakRow streakKey="social" count={3} best={3} graceUsed={false} />);
    expect(screen.queryByText('GRACE')).toBeNull();
    rerender(<StreakRow streakKey="social" count={3} best={3} graceUsed />);
    expect(screen.getByText('GRACE')).toBeTruthy();
  });

  it('renders across the small / medium / large flame size buckets', () => {
    // sm (<10), md (10-19), lg (>=20) — all should render their count.
    expect(render(<StreakRow streakKey="workout" count={4} best={4} graceUsed={false} />).toJSON()).toBeTruthy();
    expect(render(<StreakRow streakKey="workout" count={15} best={15} graceUsed={false} />).toJSON()).toBeTruthy();
    expect(render(<StreakRow streakKey="workout" count={25} best={25} graceUsed={false} />).toJSON()).toBeTruthy();
  });
});
