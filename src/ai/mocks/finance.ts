import { FinancialPlan, WeeklyFinanceInsight } from '../types';

export const MOCK_FINANCIAL_PLAN: FinancialPlan = {
  summary: 'Based on your income and timeline, you can reach your home down payment goal by saving aggressively and investing conservatively. Focus on reducing discretionary spending and building a side income stream.',
  monthlyTarget: 2500,
  strategy: [
    { category: 'savings', action: 'Automate $1,500/month to a high-yield savings account', monthlyImpact: 1500, priority: 1 },
    { category: 'expense_reduction', action: 'Audit subscriptions and reduce dining out by 50%', monthlyImpact: 400, priority: 2 },
    { category: 'investment', action: 'Put $400/month into a low-risk index fund (S&P 500)', monthlyImpact: 400, priority: 3 },
    { category: 'income', action: 'Freelance 5 hours/week in your domain for extra income', monthlyImpact: 600, priority: 4 },
    { category: 'debt', action: 'Pay off credit card balance to eliminate interest charges', monthlyImpact: 150, priority: 5 },
  ],
  milestones: [
    { title: 'Emergency Fund Complete', targetAmount: 5000, targetDate: '2026-06-01' },
    { title: 'First $10K Saved', targetAmount: 10000, targetDate: '2026-09-01' },
    { title: '25% of Goal', targetAmount: 18750, targetDate: '2027-01-01' },
    { title: 'Halfway There', targetAmount: 37500, targetDate: '2027-08-01' },
    { title: 'Down Payment Ready', targetAmount: 75000, targetDate: '2028-06-01' },
  ],
  weeklyTips: [
    'Review your bank statement every Sunday — awareness is the first step to control.',
    'Use the 24-hour rule: wait a day before any purchase over $50.',
    'Cook meals in bulk on weekends to cut food costs by 40%.',
  ],
};

export const MOCK_WEEKLY_INSIGHT: WeeklyFinanceInsight = {
  headline: 'You\'re 12% ahead of schedule!',
  insight: 'Your savings rate this month is $2,800 — that\'s $300 above your monthly target. At this pace, you\'ll hit your next milestone 3 weeks early.',
  actionItem: 'This week, review your investment allocation and consider increasing your index fund contribution by $100/month.',
  motivationalNote: 'Every dollar saved today is a brick in your future home. You\'re building something real — keep going!',
};
