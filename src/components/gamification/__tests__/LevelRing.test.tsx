import { render, screen } from '@testing-library/react-native';
import { LevelRing } from '@/components/gamification/LevelRing';
import { xpProgressInLevel } from '@/utils/gamification';

describe('LevelRing', () => {
  it('renders the computed level number and the LVL caption by default', () => {
    const { level } = xpProgressInLevel(450);
    render(<LevelRing xp={450} />);
    expect(screen.getByText(String(level))).toBeTruthy();
    expect(screen.getByText('LVL')).toBeTruthy();
  });

  it('hides the centre label when showLabel is false', () => {
    render(<LevelRing xp={450} showLabel={false} />);
    expect(screen.queryByText('LVL')).toBeNull();
  });

  it('renders without crashing at zero XP and a custom size', () => {
    expect(render(<LevelRing xp={0} size={120} ringColor="#FF6B6B" />).toJSON()).toBeTruthy();
  });
});
