/**
 * Today hero deck — the swipeable carousel and its two new folded-in panels
 * (Streaks, Today's Quest). Paging/peek motion is gesture-driven and
 * device-verified; here we hold the structure to a contract: every panel
 * mounts, each slide carries an a11y label, the single-panel case drops the
 * carousel chrome, and the panels render their data + empty states.
 */
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { LifeHeroCarousel, HERO_PANEL_HEIGHT, type HeroPanelSpec } from '@/components/shared/LifeHeroCarousel';
import { HeroStreaksPanel } from '@/components/shared/HeroStreaksPanel';
import { HeroQuestPanel } from '@/components/shared/HeroQuestPanel';
import type { Quest } from '@/constants/gamification';

function panel(key: string, accessibilityLabel: string, body: string): HeroPanelSpec {
  return { key, accessibilityLabel, render: () => <Text>{body}</Text> };
}

const quest = (id: string, title: string, progress: number, total: number): Quest => ({
  id,
  title,
  module: 'health',
  xp: 30,
  progress,
  total,
  type: 'daily',
});

describe('LifeHeroCarousel', () => {
  it('renders a lone panel without carousel chrome', () => {
    render(<LifeHeroCarousel height={HERO_PANEL_HEIGHT} panels={[panel('a', 'Your next move', 'ONLY')]} />);
    expect(screen.getByText('ONLY')).toBeTruthy();
  });

  it('mounts every panel and labels each slide', () => {
    render(
      <LifeHeroCarousel
        height={HERO_PANEL_HEIGHT}
        panels={[
          panel('move', 'Your next move', 'MOVE'),
          panel('streaks', 'Your streaks', 'STREAKS'),
          panel('quests', "Today's quests", 'QUESTS'),
        ]}
      />,
    );
    expect(screen.getByText('MOVE')).toBeTruthy();
    expect(screen.getByText('STREAKS')).toBeTruthy();
    expect(screen.getByText('QUESTS')).toBeTruthy();
    expect(screen.getByLabelText('Your streaks')).toBeTruthy();
    expect(screen.getByLabelText("Today's quests")).toBeTruthy();
  });

  it('does not crash with an empty panel list', () => {
    const { toJSON } = render(<LifeHeroCarousel height={HERO_PANEL_HEIGHT} panels={[]} />);
    expect(toJSON()).toBeTruthy();
  });
});

describe('HeroStreaksPanel', () => {
  it('renders the flagship streak, active count, and badge progress', () => {
    render(
      <HeroStreaksPanel
        streaks={[
          { key: 'workout', count: 12, graceUsed: false },
          { key: 'learning', count: 3, graceUsed: false },
        ]}
      />,
    );
    expect(screen.getByText('Streaks')).toBeTruthy();
    expect(screen.getByText('Workout')).toBeTruthy();
    expect(screen.getByText('2 active')).toBeTruthy();
    expect(screen.getByText('18 days to a 30-day badge')).toBeTruthy();
  });

  it('renders the earned-badge copy once the flagship hits 30', () => {
    render(<HeroStreaksPanel streaks={[{ key: 'workout', count: 30, graceUsed: false }]} />);
    expect(screen.getByText('30-day badge earned')).toBeTruthy();
    expect(screen.getByText('One going strong — start another today.')).toBeTruthy();
  });

  it('returns null with no active streaks', () => {
    const { toJSON } = render(<HeroStreaksPanel streaks={[]} />);
    expect(toJSON()).toBeNull();
  });
});

describe('HeroQuestPanel', () => {
  it('renders quests and the done count', () => {
    render(
      <HeroQuestPanel
        quests={[quest('q1', 'Log 3 meals', 2, 3), quest('q2', 'Walk the dog', 1, 1)]}
        onQuestPress={() => {}}
      />,
    );
    expect(screen.getByText("Today's quest")).toBeTruthy();
    expect(screen.getByText('Log 3 meals')).toBeTruthy();
    expect(screen.getByText('1/2 done')).toBeTruthy();
  });

  it('caps at two cards and shows a "+N more" footer', () => {
    render(
      <HeroQuestPanel
        quests={[quest('q1', 'A', 0, 3), quest('q2', 'B', 0, 3), quest('q3', 'C', 0, 3)]}
        onQuestPress={() => {}}
      />,
    );
    expect(screen.getByText('+1 more quest today')).toBeTruthy();
    expect(screen.queryByText('C')).toBeNull();
  });

  it('returns null with no quests', () => {
    const { toJSON } = render(<HeroQuestPanel quests={[]} onQuestPress={() => {}} />);
    expect(toJSON()).toBeNull();
  });
});
