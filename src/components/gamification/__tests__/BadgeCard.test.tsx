import { render, screen } from '@testing-library/react-native';
import { BadgeCard } from '@/components/gamification/BadgeCard';
import { BADGE_META } from '@/constants/gamification';

describe('BadgeCard', () => {
  it('renders the badge label and description', () => {
    render(<BadgeCard badgeId="goal_complete" earned />);
    expect(screen.getByText(BADGE_META.goal_complete.label)).toBeTruthy();
    expect(screen.getByText(BADGE_META.goal_complete.desc)).toBeTruthy();
  });

  it('exposes an "earned" accessibility label when earned', () => {
    render(<BadgeCard badgeId="goal_complete" earned />);
    expect(screen.getByLabelText(`${BADGE_META.goal_complete.label} badge, earned`)).toBeTruthy();
  });

  it('exposes a "locked" accessibility label when not earned', () => {
    render(<BadgeCard badgeId="streak_30_any" earned={false} />);
    expect(screen.getByLabelText(`${BADGE_META.streak_30_any.label} badge, locked`)).toBeTruthy();
  });

  it('exposes an "unlocking" accessibility label during the unlock animation', () => {
    render(<BadgeCard badgeId="week_1" earned={false} unlock="unlocking" />);
    expect(screen.getByLabelText(`${BADGE_META.week_1.label} badge, unlocking`)).toBeTruthy();
  });

  it('treats unlock="unlocked" as earned', () => {
    render(<BadgeCard badgeId="first_blueprint" earned={false} unlock="unlocked" />);
    expect(screen.getByLabelText(`${BADGE_META.first_blueprint.label} badge, earned`)).toBeTruthy();
  });
});
