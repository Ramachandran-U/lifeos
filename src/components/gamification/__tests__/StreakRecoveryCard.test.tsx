import { render, screen, fireEvent } from '@testing-library/react-native';
import { StreakRecoveryCard } from '@/components/gamification/StreakRecoveryCard';

describe('StreakRecoveryCard', () => {
  it('frames the loss as a break and leads with the fix', () => {
    render(
      <StreakRecoveryCard streakKey="workout" lostCount={12} onRestore={jest.fn()} onDismiss={jest.fn()} />,
    );
    expect(screen.getByText(/12-day Workout streak took a break/)).toBeTruthy();
    expect(screen.getByText(/Pick the run back up at 13 days/)).toBeTruthy();
  });

  it('fires onRestore from the CTA and onDismiss from "Not today"', () => {
    const onRestore = jest.fn();
    const onDismiss = jest.fn();
    render(
      <StreakRecoveryCard streakKey="social" lostCount={5} onRestore={onRestore} onDismiss={onDismiss} />,
    );
    fireEvent.press(screen.getByLabelText('Restore Social streak'));
    expect(onRestore).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByText('Not today'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // Compassion guard — the loss card is the highest-risk copy surface.
  it('contains no guilt or threat phrasing', () => {
    render(
      <StreakRecoveryCard streakKey="journaling" lostCount={30} onRestore={jest.fn()} onDismiss={jest.fn()} />,
    );
    const banned = /fail|broke your|lost everything|reset to zero|shame|guilt|disappointed/i;
    expect(banned.test(JSON.stringify(screen.toJSON()))).toBe(false);
  });
});
