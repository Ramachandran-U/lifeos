/**
 * HealthStreakRow — Ink + Signal §3.0.5 zero-suppression, AC8 unit half
 * (Health streak rows) + AC11 (gamification visibility).
 *
 * A streak row renders NOTHING at zero — no "0 days", no zero surface; the
 * logging actions are what produce the first value. With gamification set to
 * 'off' the row is null at any count.
 */

import { render, screen } from '@testing-library/react-native';
import { HealthStreakRow } from '@/components/modules/health/HealthStreakRow';
import { usePreferencesStore } from '@/store/usePreferencesStore';

afterEach(() => {
  usePreferencesStore.setState({ gamification: 'full' });
});

describe('HealthStreakRow — zero-suppression (AC8)', () => {
  it('Food log streak renders null at 0', () => {
    const tree = render(<HealthStreakRow label="Food log streak" days={0} />);
    expect(tree.toJSON()).toBeNull();
  });

  it('Workout streak renders null at 0', () => {
    const tree = render(<HealthStreakRow label="Workout streak" days={0} />);
    expect(tree.toJSON()).toBeNull();
  });

  it('renders null at negative counts too (defensive)', () => {
    const tree = render(<HealthStreakRow label="Workout streak" days={-1} />);
    expect(tree.toJSON()).toBeNull();
  });

  it('renders the committed copy when the streak is alive', () => {
    render(<HealthStreakRow label="Food log streak" days={4} />);
    expect(screen.getByText('Food log streak · 4 days')).toBeTruthy();
  });

  it('renders the workout row when alive', () => {
    render(<HealthStreakRow label="Workout streak" days={12} />);
    expect(screen.getByText('Workout streak · 12 days')).toBeTruthy();
  });
});

describe('HealthStreakRow — gamification visibility (AC11)', () => {
  it('renders null when gamification is off, even with a live streak', () => {
    usePreferencesStore.setState({ gamification: 'off' });
    const tree = render(<HealthStreakRow label="Food log streak" days={9} />);
    expect(tree.toJSON()).toBeNull();
  });
});
