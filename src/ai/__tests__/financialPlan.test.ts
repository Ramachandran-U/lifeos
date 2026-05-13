import { buildMockFinancialPlan } from '../mocks/finance';
import { FinancialPlanSchema } from '../types';
import type { FinanceInput } from '../types';

function makeInput(overrides: Partial<FinanceInput> = {}): FinanceInput {
  return {
    goalType: 'home',
    targetAmount: 2_500_000,
    targetDate: '2028-06-01',
    monthlySavings: 50_000,
    incomeBracket: '12_25lpa',
    riskProfile: 'moderate',
    currency: 'INR',
    ...overrides,
  };
}

describe('buildMockFinancialPlan', () => {
  it('passes the Zod schema', () => {
    const plan = buildMockFinancialPlan(makeInput());
    expect(() => FinancialPlanSchema.parse(plan)).not.toThrow();
  });

  it('final milestone equals target amount (no overshoot / undershoot)', () => {
    const plan = buildMockFinancialPlan(makeInput({ targetAmount: 2_500_000 }));
    const last = plan.milestones[plan.milestones.length - 1];
    expect(last.targetAmount).toBe(2_500_000);
  });

  it('no milestone exceeds the target', () => {
    const plan = buildMockFinancialPlan(makeInput({ targetAmount: 25_000 }));
    for (const m of plan.milestones) {
      expect(m.targetAmount).toBeLessThanOrEqual(25_000);
    }
  });

  it('milestones are non-decreasing in both amount and date', () => {
    const plan = buildMockFinancialPlan(makeInput({ targetAmount: 1_000_000, targetDate: '2030-01-01' }));
    for (let i = 1; i < plan.milestones.length; i++) {
      const prev = plan.milestones[i - 1];
      const curr = plan.milestones[i];
      expect(curr.targetAmount).toBeGreaterThanOrEqual(prev.targetAmount);
      expect(new Date(curr.targetDate).getTime()).toBeGreaterThanOrEqual(new Date(prev.targetDate).getTime());
    }
  });

  it('monthlyTarget matches provided monthlySavings', () => {
    const plan = buildMockFinancialPlan(makeInput({ monthlySavings: 35_000 }));
    expect(plan.monthlyTarget).toBe(35_000);
  });

  it('strategy monthly impacts are non-negative and non-trivial', () => {
    const plan = buildMockFinancialPlan(makeInput());
    expect(plan.strategy.length).toBeGreaterThanOrEqual(3);
    for (const s of plan.strategy) {
      expect(s.monthlyImpact).toBeGreaterThan(0);
    }
  });

  it('renders INR-flavoured free text (contains ₹)', () => {
    const plan = buildMockFinancialPlan(makeInput());
    expect(plan.summary).toMatch(/₹/);
    expect(plan.milestones.every((m) => m.title.includes('₹'))).toBe(true);
  });

  it('handles small targets (₹25,000) without producing overshoot milestones', () => {
    const plan = buildMockFinancialPlan(makeInput({
      targetAmount: 25_000,
      monthlySavings: 2_500,
      targetDate: '2026-12-01',
    }));
    expect(plan.milestones[plan.milestones.length - 1].targetAmount).toBe(25_000);
    expect(Math.max(...plan.milestones.map((m) => m.targetAmount))).toBe(25_000);
  });

  it('handles 0 target gracefully (degenerate input)', () => {
    const plan = buildMockFinancialPlan(makeInput({ targetAmount: 0, monthlySavings: 0 }));
    expect(() => FinancialPlanSchema.parse(plan)).not.toThrow();
    expect(plan.milestones.every((m) => m.targetAmount === 0)).toBe(true);
  });
});
