import { load, save } from './_io';
import { FINANCIAL_GOALS_KEY, FINANCE_MILESTONES_KEY } from './_keys';

export interface WebFinancialGoal {
  id: string;
  title: string;
  goalType: string;
  targetAmount?: number;
  currency: string;
  targetDate?: string;
  incomeBracket?: string;
  monthlySavings?: number;
  riskProfile?: string;
  status: string;
  metadata?: string;
  createdAt: string;
  updatedAt: string;
}

export function webInsertFinancialGoal(goal: WebFinancialGoal): void {
  const all = load<WebFinancialGoal>(FINANCIAL_GOALS_KEY);
  all.push(goal);
  save(FINANCIAL_GOALS_KEY, all);
}

export function webGetFinancialGoals(): WebFinancialGoal[] {
  return load<WebFinancialGoal>(FINANCIAL_GOALS_KEY).filter((g) => g.status === 'active');
}

export function webGetFinancialGoalById(id: string): WebFinancialGoal | undefined {
  return load<WebFinancialGoal>(FINANCIAL_GOALS_KEY).find((g) => g.id === id);
}

export function webUpdateFinancialGoal(
  id: string,
  data: Partial<Omit<WebFinancialGoal, 'id' | 'createdAt'>>,
): void {
  const all = load<WebFinancialGoal>(FINANCIAL_GOALS_KEY);
  const idx = all.findIndex((g) => g.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
  save(FINANCIAL_GOALS_KEY, all);
}

export interface WebFinanceMilestone {
  id: string;
  goalId: string;
  title: string;
  targetAmount: number;
  targetDate: string;
  completedAt?: string;
  createdAt: string;
}

export function webInsertMilestone(m: WebFinanceMilestone): void {
  const all = load<WebFinanceMilestone>(FINANCE_MILESTONES_KEY);
  all.push(m);
  save(FINANCE_MILESTONES_KEY, all);
}

export function webGetMilestonesByGoal(goalId: string): WebFinanceMilestone[] {
  return load<WebFinanceMilestone>(FINANCE_MILESTONES_KEY).filter((m) => m.goalId === goalId);
}

export function webCompleteMilestone(id: string): void {
  const all = load<WebFinanceMilestone>(FINANCE_MILESTONES_KEY);
  const idx = all.findIndex((m) => m.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], completedAt: new Date().toISOString() };
  save(FINANCE_MILESTONES_KEY, all);
}

export function webDeleteMilestonesByGoal(goalId: string): void {
  const all = load<WebFinanceMilestone>(FINANCE_MILESTONES_KEY);
  save(FINANCE_MILESTONES_KEY, all.filter((m) => m.goalId !== goalId));
}
