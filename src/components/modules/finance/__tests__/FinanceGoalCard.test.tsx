import { render, screen } from '@testing-library/react-native';
import { FinanceGoalCard } from '@/components/modules/finance/FinanceGoalCard';

describe('FinanceGoalCard', () => {
  it('renders the title and the static eyebrow label', () => {
    render(
      <FinanceGoalCard
        title="Emergency fund"
        goalType="emergency_fund"
        targetAmount={100000}
        currentSaved={25000}
        monthlyTarget={5000}
        targetDate="2027-01-01"
      />,
    );
    expect(screen.getByText('Emergency fund')).toBeTruthy();
    expect(screen.getByText('YOUR GOAL')).toBeTruthy();
  });

  it('computes progress percent from saved / target', () => {
    render(
      <FinanceGoalCard
        title="Home down payment"
        goalType="home"
        targetAmount={200000}
        currentSaved={50000}
        monthlyTarget={4000}
        targetDate="2028-06-01"
      />,
    );
    // 50000 / 200000 = 25%
    expect(screen.getByText('25% complete')).toBeTruthy();
  });

  it('guards against a zero target (0% complete, no divide-by-zero)', () => {
    render(
      <FinanceGoalCard
        title="Unset target"
        goalType="other"
        targetAmount={0}
        currentSaved={500}
        monthlyTarget={100}
        targetDate="2030-01-01"
      />,
    );
    expect(screen.getByText('0% complete')).toBeTruthy();
  });
});
