import { render, screen, fireEvent } from '@testing-library/react-native';
import { MilestoneOverlay } from '@/components/gamification/MilestoneOverlay';

describe('MilestoneOverlay', () => {
  it('renders nothing when there is no pending milestone', () => {
    const { toJSON } = render(<MilestoneOverlay milestone={null} onClose={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it('renders identity-framed copy for a 7-day tier', () => {
    render(
      <MilestoneOverlay milestone={{ streakKey: 'workout', tier: 7 }} onClose={jest.fn()} />,
    );
    expect(screen.getByText(/7 days of showing up for Workout/)).toBeTruthy();
    expect(screen.getByText('ONE FULL WEEK 🔥')).toBeTruthy();
  });

  it('renders the 100-day tier with its own copy and dismisses on tap', () => {
    const onClose = jest.fn();
    render(
      <MilestoneOverlay milestone={{ streakKey: 'learning', tier: 100 }} onClose={onClose} />,
    );
    expect(screen.getByText(/100 days\. Learning is who you are now\./)).toBeTruthy();
    fireEvent.press(screen.getByLabelText(/100-day Learning streak milestone/));
    expect(onClose).toHaveBeenCalled();
  });

  // Compassion guard: milestone copy must never threaten or guilt.
  it.each([7, 30, 100, 365] as const)('tier %i copy contains no guilt phrasing', (tier) => {
    render(
      <MilestoneOverlay milestone={{ streakKey: 'social', tier }} onClose={jest.fn()} />,
    );
    const banned = /don't break|do not break|or lose|failure|guilt|shame/i;
    // Assert over everything rendered.
    const tree = JSON.stringify(screen.toJSON());
    expect(banned.test(tree)).toBe(false);
  });
});
