import { render, screen, fireEvent } from '@testing-library/react-native';
import { BadgeTile } from '@/components/gamification/BadgeTile';
import { BADGE_META } from '@/constants/gamification';

describe('BadgeTile', () => {
  it('renders the emoji, label and description when earned', () => {
    render(<BadgeTile badgeId="goal_complete" earned />);
    expect(screen.getByText(BADGE_META.goal_complete.emoji)).toBeTruthy();
    expect(screen.getByText(BADGE_META.goal_complete.label)).toBeTruthy();
    expect(screen.getByText(BADGE_META.goal_complete.desc)).toBeTruthy();
  });

  it('shows a lock glyph (not the badge emoji) when locked', () => {
    render(<BadgeTile badgeId="skill_mastery" earned={false} />);
    expect(screen.getByText('🔒')).toBeTruthy();
    expect(screen.queryByText(BADGE_META.skill_mastery.emoji)).toBeNull();
  });

  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    render(<BadgeTile badgeId="week_1" earned onPress={onPress} />);
    fireEvent.press(screen.getByText(BADGE_META.week_1.label));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
