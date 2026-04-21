import type { FinancialPlan, WeeklyFinanceInsight, FinanceInput } from '../types';

function formatInr(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(n % 1e7 === 0 ? 0 : 1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(n % 1e5 === 0 ? 0 : 1)}L`;
  if (n >= 1000) return `₹${Math.round(n / 1000)}K`;
  return `₹${n}`;
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00Z' : ''));
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function monthsBetween(startIso: string, endIso: string): number {
  const s = new Date(startIso + 'T00:00:00Z');
  const e = new Date(endIso.length === 10 ? endIso + 'T00:00:00Z' : endIso);
  return Math.max(1, (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth()));
}

/**
 * Build a mock financial plan that scales to the user's actual inputs. All
 * amounts are denominated in the submitted currency (defaults to INR). The
 * milestones are fractions of the target spread across the real timeline;
 * strategy monthly impacts sum to roughly the monthly target.
 */
export function buildMockFinancialPlan(input: FinanceInput): FinancialPlan {
  const target = Math.max(0, Math.round(input.targetAmount || 0));
  const today = new Date().toISOString().slice(0, 10);
  const months = monthsBetween(today, input.targetDate || addMonths(today, 24));
  const monthlyTarget = Math.max(1, Math.round(input.monthlySavings || Math.ceil(target / months)));

  // Strategy monthly impacts sum to monthlyTarget.
  const automated = Math.round(monthlyTarget * 0.6);
  const reduction = Math.round(monthlyTarget * 0.15);
  const invested = Math.round(monthlyTarget * 0.15);
  const extraIncome = Math.round(monthlyTarget * 0.3);
  const debt = Math.max(1, monthlyTarget - (automated + reduction + invested));

  // Milestones: 5 evenly-spaced fractions of the target, dated proportionally.
  const fractions = [0.1, 0.25, 0.5, 0.75, 1];
  const milestones = fractions.map((f, i) => {
    const amount = Math.round(target * f);
    const milestoneDate = addMonths(today, Math.max(1, Math.round(months * f)));
    const title =
      i === 0 ? `${formatInr(amount)} saved — first proof` :
      i === 1 ? `${formatInr(amount)} saved — 25% of goal` :
      i === 2 ? `${formatInr(amount)} saved — halfway there` :
      i === 3 ? `${formatInr(amount)} saved — 75% milestone` :
      `${formatInr(amount)} — goal reached`;
    return { title, targetAmount: amount, targetDate: milestoneDate };
  });

  const summary =
    `To reach ${formatInr(target)} by ${input.targetDate || 'your target date'}, ` +
    `save roughly ${formatInr(monthlyTarget)}/month. Automate the core, cut the leaks, and add one income lever.`;

  return {
    summary,
    monthlyTarget,
    strategy: [
      { category: 'savings',           action: `Automate ${formatInr(automated)}/month to a high-yield savings or liquid fund`, monthlyImpact: automated,   priority: 1 },
      { category: 'expense_reduction', action: `Audit subscriptions and dining-out to free ~${formatInr(reduction)}/month`,     monthlyImpact: reduction,   priority: 2 },
      { category: 'investment',        action: `SIP ${formatInr(invested)}/month into a Nifty 50 index fund`,                    monthlyImpact: invested,    priority: 3 },
      { category: 'income',            action: `Freelance 5 hrs/week to add ~${formatInr(extraIncome)}/month`,                   monthlyImpact: extraIncome, priority: 4 },
      { category: 'debt',              action: 'Clear high-interest credit-card balance to stop the interest leak',              monthlyImpact: debt,        priority: 5 },
    ],
    milestones,
    weeklyTips: [
      'Review your bank statement every Sunday — awareness is the first step to control.',
      `Use the 24-hour rule: wait a day before any discretionary spend over ${formatInr(Math.max(500, Math.round(monthlyTarget / 20)))}.`,
      'Cook in bulk on weekends to cut food costs by 30–40%.',
    ],
  };
}

/** Back-compat: default-inputs version for code paths that don't have user input yet. */
export const MOCK_FINANCIAL_PLAN: FinancialPlan = buildMockFinancialPlan({
  goalType: 'home',
  targetAmount: 2_500_000,
  targetDate: '2028-06-01',
  monthlySavings: 50_000,
  incomeBracket: '12_25lpa',
  riskProfile: 'moderate',
  currency: 'INR',
});

export const MOCK_WEEKLY_INSIGHT: WeeklyFinanceInsight = {
  headline: 'You\'re 12% ahead of schedule!',
  insight: 'Your savings rate this month is ₹65,000 — that\'s ₹7,500 above your monthly target. At this pace, you\'ll hit your next milestone 3 weeks early.',
  actionItem: 'This week, review your investment allocation and consider increasing your index-fund SIP by ₹2,500/month.',
  motivationalNote: 'Every rupee saved today is a brick in your future home. You\'re building something real — keep going!',
};
