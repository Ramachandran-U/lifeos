import { render, screen, fireEvent } from '@testing-library/react-native';
import { BadgeTile } from '@/components/gamification/BadgeTile';
import { BADGE_META, BADGE_TIER_META } from '@/constants/gamification';

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

  it('renders the rarity tier label — a Rare badge exercises the brand-violet accent', () => {
    // life_balance is the Rare tier; covers the tier==='rare' colour branch.
    render(<BadgeTile badgeId="life_balance" earned />);
    expect(screen.getByText(BADGE_TIER_META.rare.label.toUpperCase())).toBeTruthy();
  });

  it('shows a Mastery tier label on a locked mastery badge', () => {
    render(<BadgeTile badgeId="skill_mastery" earned={false} />);
    expect(screen.getByText(BADGE_TIER_META.mastery.label.toUpperCase())).toBeTruthy();
  });
});
