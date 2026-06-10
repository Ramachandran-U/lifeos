import { render, screen } from '@testing-library/react-native';
import { FinanceBreakdownChart } from '@/components/charts/FinanceBreakdownChart';

const SLICES = [
  { label: 'Food & dining', value: 6000, color: '#F59E0B' },
  { label: 'Transport', value: 2000, color: '#60A5FA' },
];

describe('FinanceBreakdownChart', () => {
  it('renders a legend row per slice with formatted amounts', () => {
    render(<FinanceBreakdownChart slices={SLICES} formatValue={(v) => `₹${v}`} />);
    expect(screen.getByText('Food & dining')).toBeTruthy();
    expect(screen.getByText('Transport')).toBeTruthy();
    expect(screen.getByText('₹6000')).toBeTruthy();
    expect(screen.getByText('₹2000')).toBeTruthy();
  });

  it('renders nothing extra for an empty slice list', () => {
    render(<FinanceBreakdownChart slices={[]} formatValue={(v) => `${v}`} />);
    expect(screen.queryByText(/₹/)).toBeNull();
  });
});
