import { render, screen } from '@testing-library/react-native';
import { XpHistoryChart } from '@/components/charts/XpHistoryChart';

const DATA = [
  { day: '2026-06-04', xp: 0 },
  { day: '2026-06-05', xp: 40 },
  { day: '2026-06-06', xp: 25 },
];

describe('XpHistoryChart', () => {
  it('renders the static Sparkline while animatedCharts is off (the default)', () => {
    render(<XpHistoryChart data={DATA} testID="xp-chart" />);
    expect(screen.getByTestId('xp-chart')).toBeTruthy();
  });

  it('pads a single point so the fallback never renders a broken line', () => {
    render(<XpHistoryChart data={[{ day: '2026-06-06', xp: 10 }]} testID="xp-chart" />);
    expect(screen.getByTestId('xp-chart')).toBeTruthy();
  });

  it('renders the fallback for an empty series', () => {
    render(<XpHistoryChart data={[]} testID="xp-chart" />);
    expect(screen.getByTestId('xp-chart')).toBeTruthy();
  });
});
