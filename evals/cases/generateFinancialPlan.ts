import { FinancialPlanSchema, type FinancialPlan, type FinanceInput } from '@/ai/types';
import { generateFinancialPlan } from '@/ai/functions';
import { schemaValid, check } from '../grader';
import type { EvalSuite } from '../types';

const today = new Date();
const inYears = (y: number) => new Date(today.getTime() + y * 365 * 86400000).toISOString().slice(0, 10);

const suite: EvalSuite<FinanceInput, FinancialPlan> = {
  name: 'generateFinancialPlan',
  threshold: 1.0,
  run: generateFinancialPlan,
  cases: [
    {
      name: 'home-5yr-50L',
      input: {
        goalType: 'home',
        targetAmount: 5_000_000,
        targetDate: inYears(5),
        monthlySavings: 50_000,
        incomeBracket: '15-25 LPA',
        riskProfile: 'moderate',
        currency: 'INR',
      },
      graders: [
        schemaValid(FinancialPlanSchema),
        check('milestones <= target', (o) => o.milestones.every((m) => m.targetAmount <= 5_000_000), 'milestone exceeds target'),
        check('milestones non-decreasing', (o) => {
          const amounts = o.milestones.map((m) => m.targetAmount);
          return amounts.every((a, i) => i === 0 || a >= amounts[i - 1]!);
        }),
        check('strategy non-empty', (o) => o.strategy.length > 0),
        check('weeklyTips non-empty', (o) => o.weeklyTips.length > 0),
        check('monthlyTarget positive', (o) => o.monthlyTarget > 0),
      ],
    },
    {
      name: 'emergency-fund-1yr',
      input: {
        goalType: 'emergency_fund',
        targetAmount: 600_000,
        targetDate: inYears(1),
        monthlySavings: 50_000,
        incomeBracket: '10-15 LPA',
        riskProfile: 'conservative',
        currency: 'INR',
      },
      graders: [
        schemaValid(FinancialPlanSchema),
        check('all milestones <= target', (o) => o.milestones.every((m) => m.targetAmount <= 600_000)),
      ],
    },
    {
      name: 'retirement-25yr-5cr',
      input: {
        goalType: 'retirement',
        targetAmount: 50_000_000,
        targetDate: inYears(25),
        monthlySavings: 100_000,
        incomeBracket: '25-50 LPA',
        riskProfile: 'aggressive',
        currency: 'INR',
      },
      graders: [
        schemaValid(FinancialPlanSchema),
        check('milestones <= target', (o) => o.milestones.every((m) => m.targetAmount <= 50_000_000)),
        check('summary mentions amount', (o) => /\d/.test(o.summary)),
      ],
    },
  ],
};

export default suite;
