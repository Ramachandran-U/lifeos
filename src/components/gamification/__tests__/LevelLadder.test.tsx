import { render, screen } from '@testing-library/react-native';
import { LevelLadder } from '@/components/gamification/LevelLadder';
import { LEVEL_PERKS } from '@/constants/gamification';

describe('LevelLadder', () => {
  it('renders the current level plus the next four steps', () => {
    render(<LevelLadder currentLevel={3} />);
    expect(screen.getByText('LVL 3 PERKS')).toBeTruthy();
    expect(screen.getByText('LVL 4 PERKS')).toBeTruthy();
    expect(screen.getByText('LVL 7 PERKS')).toBeTruthy();
  });

  it('marks the current step with the YOU badge', () => {
    render(<LevelLadder currentLevel={5} />);
    expect(screen.getByText('YOU')).toBeTruthy();
  });

  it('renders the known perks for a level', () => {
    render(<LevelLadder currentLevel={3} />);
    for (const perk of LEVEL_PERKS[3]) {
      expect(screen.getByText(perk)).toBeTruthy();
    }
  });

  it('falls back to "Perks soon" for a level with no defined perks', () => {
    // Levels above the LEVEL_PERKS table (max key is 12) have no perks.
    render(<LevelLadder currentLevel={20} />);
    expect(screen.getAllByText('Perks soon').length).toBeGreaterThan(0);
  });
});
