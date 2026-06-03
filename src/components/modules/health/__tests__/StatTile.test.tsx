import { render, screen } from '@testing-library/react-native';
import { StatTile } from '@/components/modules/health/StatTile';

describe('StatTile', () => {
  it('renders the label, value and unit', () => {
    render(<StatTile iconName="walk" label="Steps" value="8,200" unit="steps" color="#4ECDC4" />);
    expect(screen.getByText('Steps')).toBeTruthy();
    expect(screen.getByText('8,200')).toBeTruthy();
    expect(screen.getByText('steps')).toBeTruthy();
  });

  it('hides the trend when trendPct is null', () => {
    render(<StatTile iconName="walk" label="Steps" value="100" color="#fff" trendPct={null} />);
    expect(screen.queryByText('0%')).toBeNull();
    expect(screen.queryByText(/%$/)).toBeNull();
  });

  it('hides the trend when trendPct is undefined', () => {
    render(<StatTile iconName="walk" label="Steps" value="100" color="#fff" />);
    expect(screen.queryByText(/%$/)).toBeNull();
  });

  it('shows an upward trend percentage', () => {
    render(<StatTile iconName="walk" label="Steps" value="100" color="#fff" trendPct={12} />);
    expect(screen.getByText('12%')).toBeTruthy();
  });

  it('shows a downward trend with the absolute percentage', () => {
    render(<StatTile iconName="walk" label="Steps" value="100" color="#fff" trendPct={-8} />);
    expect(screen.getByText('8%')).toBeTruthy();
  });

  it('renders without crashing when given a sparkline series', () => {
    render(
      <StatTile
        iconName="flame"
        label="Calories"
        value="1900"
        color="#FF6B6B"
        series={[1800, 2000, 1900, 2100]}
        target={2000}
      />,
    );
    expect(screen.getByText('Calories')).toBeTruthy();
  });
});
