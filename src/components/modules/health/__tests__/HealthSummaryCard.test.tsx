import { render, screen } from '@testing-library/react-native';
import { HealthSummaryCard } from '@/components/modules/health/HealthSummaryCard';
import type { VitalsSummary } from '@/utils/health';

const baseSummary: VitalsSummary = {
  bmi: 22.9,
  category: 'healthy',
  headline: 'In a healthy range',
  detail: 'BMI 22.9 — healthy.',
  suggestions: [],
};

describe('HealthSummaryCard', () => {
  it('renders the headline and detail', () => {
    render(<HealthSummaryCard summary={baseSummary} />);
    expect(screen.getByText('HEALTH SUMMARY')).toBeTruthy();
    expect(screen.getByText('In a healthy range')).toBeTruthy();
    expect(screen.getByText('BMI 22.9 — healthy.')).toBeTruthy();
  });

  it('renders no suggestion rows when suggestions is empty', () => {
    render(<HealthSummaryCard summary={baseSummary} />);
    expect(screen.queryByText('Aim for a small daily calorie deficit.')).toBeNull();
  });

  it('renders each suggestion when present', () => {
    render(
      <HealthSummaryCard
        summary={{
          ...baseSummary,
          suggestions: ['Drink more water', 'Walk 8k steps'],
        }}
      />,
    );
    expect(screen.getByText('Drink more water')).toBeTruthy();
    expect(screen.getByText('Walk 8k steps')).toBeTruthy();
  });
});
