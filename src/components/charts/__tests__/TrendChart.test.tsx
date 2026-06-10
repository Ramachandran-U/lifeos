import { render, screen } from '@testing-library/react-native';
import { TrendChart } from '@/components/charts/TrendChart';

describe('TrendChart', () => {
  it('renders the static Sparkline while animatedCharts is off (the default)', () => {
    render(<TrendChart values={[71.2, 70.8, 70.5]} hue="#34D399" testID="trend" />);
    expect(screen.getByTestId('trend')).toBeTruthy();
  });

  it('handles a single point without crashing (zero-padded fallback)', () => {
    render(<TrendChart values={[70.1]} hue="#34D399" testID="trend" />);
    expect(screen.getByTestId('trend')).toBeTruthy();
  });
});
