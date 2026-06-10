import { render, screen } from '@testing-library/react-native';
import { ProgressPath } from '@/components/gamification/ProgressPath';
import type { Streaks } from '@/utils/gamification';

function streaks(over: Partial<Streaks> = {}): Streaks {
  return {
    workout: { count: 0, lastDate: '', graceUsed: false },
    learning: { count: 0, lastDate: '', graceUsed: false },
    foodTracking: { count: 0, lastDate: '', graceUsed: false },
    journaling: { count: 0, lastDate: '', graceUsed: false },
    social: { count: 0, lastDate: '', graceUsed: false },
    ...over,
  };
}

describe('ProgressPath (R5)', () => {
  it('marks the current level node and the next three', () => {
    render(
      <ProgressPath currentLevel={4} levelPct={0.4} streaks={streaks()} badgeCount={0} />,
    );
    expect(screen.getByText('YOU ARE HERE')).toBeTruthy();
    expect(screen.getByText(/^L4 · /)).toBeTruthy();
    expect(screen.getByText(/^L7 · /)).toBeTruthy();
  });

  it('shows earned milestone tiers and the badge count as trail landmarks', () => {
    render(
      <ProgressPath
        currentLevel={3}
        levelPct={0.1}
        streaks={streaks({
          workout: { count: 35, lastDate: '2026-06-10', graceUsed: false, milestones: [7, 30] },
          learning: { count: 8, lastDate: '2026-06-10', graceUsed: false, milestones: [7] },
        })}
        badgeCount={5}
      />,
    );
    expect(screen.getByText('🔥 7-day')).toBeTruthy(); // deduped across streaks
    expect(screen.getByText('🔥 30-day')).toBeTruthy();
    expect(screen.getByText('★ 5 badges')).toBeTruthy();
  });

  it('hides the landmark strip for a brand-new user', () => {
    render(<ProgressPath currentLevel={1} levelPct={0} streaks={streaks()} badgeCount={0} />);
    expect(screen.queryByText(/day$/)).toBeNull();
    expect(screen.queryByText(/badge/)).toBeNull();
  });
});
