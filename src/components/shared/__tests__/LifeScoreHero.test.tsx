import { render, screen } from '@testing-library/react-native';

// Native AsyncStorage isn't linked under jest-expo; the store import chain pulls
// it in via the persist middleware. Use AsyncStorage's official in-memory jest mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { LifeScoreHero } from '@/components/shared/LifeScoreHero';
import { useGameStore } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { useDomainHistoryStore } from '@/store/useDomainHistoryStore';
import type { ScorePoint } from '@/store/useDomainHistoryStore';

const DEFAULT_SCORES = {
  goals: 15, health: 15, finance: 15, career: 15, social: 15, polymath: 15,
};

describe('LifeScoreHero', () => {
  afterEach(() => {
    useGameStore.setState({ domainScores: { ...DEFAULT_SCORES } });
    useUserStore.getState().reset();
    useDomainHistoryStore.setState({ entries: {} });
  });

  it('renders the LIFE SCORE header and a static composite score with no history', () => {
    useGameStore.setState({
      domainScores: { goals: 80, health: 80, finance: 80, career: 80, social: 80, polymath: 80 },
    });
    useUserStore.setState({ primaryDomains: [] });
    useDomainHistoryStore.setState({ entries: {} });

    render(<LifeScoreHero />);
    expect(screen.getByText('LIFE SCORE')).toBeTruthy();
    expect(screen.getByText('80')).toBeTruthy();
    expect(screen.getByText('Thriving')).toBeTruthy(); // band for score >= 80
  });

  it('does not render the 30d/90d trend chips when history is below the threshold', () => {
    useGameStore.setState({ domainScores: { ...DEFAULT_SCORES } });
    useDomainHistoryStore.setState({ entries: {} });

    render(<LifeScoreHero />);
    expect(screen.queryByText('30d')).toBeNull();
    expect(screen.queryByText('90d')).toBeNull();
  });

  it('renders the trend chips once enough per-domain history exists', () => {
    useGameStore.setState({
      domainScores: { goals: 60, health: 60, finance: 60, career: 60, social: 60, polymath: 60 },
    });
    useUserStore.setState({ primaryDomains: [] });

    // Six consecutive daily snapshots (>= default minHistoryPoints of 5).
    const series: ScorePoint[] = [
      { date: '2026-05-25', score: 40 },
      { date: '2026-05-26', score: 45 },
      { date: '2026-05-27', score: 50 },
      { date: '2026-05-28', score: 55 },
      { date: '2026-05-29', score: 58 },
      { date: '2026-05-30', score: 60 },
    ];
    useDomainHistoryStore.setState({
      entries: {
        goals: series, health: series, finance: series,
        career: series, social: series, polymath: series,
      },
    });

    render(<LifeScoreHero />);
    expect(screen.getByText('30d')).toBeTruthy();
    expect(screen.getByText('90d')).toBeTruthy();
  });
});
