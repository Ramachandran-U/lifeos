import { render, screen } from '@testing-library/react-native';
import { AvatarRing } from '@/components/gamification/AvatarRing';
import { xpProgressInLevel } from '@/utils/gamification';

describe('AvatarRing', () => {
  it('renders the initials and the level chip', () => {
    const { level } = xpProgressInLevel(300);
    render(<AvatarRing xp={300} initials="LR" />);
    expect(screen.getByText('LR')).toBeTruthy();
    expect(screen.getByText(`Lv${level}`)).toBeTruthy();
  });

  it('renders without crashing at zero XP and a custom size', () => {
    expect(render(<AvatarRing xp={0} initials="AB" size={120} />).toJSON()).toBeTruthy();
  });
});
