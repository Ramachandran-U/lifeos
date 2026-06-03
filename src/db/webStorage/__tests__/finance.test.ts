/**
 * webStorage/finance — active-status filter on goals, partial update,
 * milestone listing by goal, completion stamp, and cascade delete.
 */

beforeAll(() => {
  const store: Record<string, string> = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
});

import {
  webInsertFinancialGoal,
  webGetFinancialGoals,
  webGetFinancialGoalById,
  webUpdateFinancialGoal,
  webInsertMilestone,
  webGetMilestonesByGoal,
  webCompleteMilestone,
  webDeleteMilestonesByGoal,
  type WebFinancialGoal,
  type WebFinanceMilestone,
} from '../finance';

function fgoal(over: Partial<WebFinancialGoal>): WebFinancialGoal {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'Emergency fund',
    goalType: 'savings',
    currency: 'USD',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function milestone(over: Partial<WebFinanceMilestone>): WebFinanceMilestone {
  return {
    id: Math.random().toString(36).slice(2),
    goalId: 'fg1',
    title: 'First 1k',
    targetAmount: 1000,
    targetDate: '2026-06-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

beforeEach(() => { localStorage.clear(); });

describe('webGetFinancialGoals', () => {
  it('returns only active goals', () => {
    webInsertFinancialGoal(fgoal({ id: 'fg1', status: 'active' }));
    webInsertFinancialGoal(fgoal({ id: 'fg2', status: 'archived' }));
    expect(webGetFinancialGoals().map((g) => g.id)).toEqual(['fg1']);
  });
});

describe('webUpdateFinancialGoal', () => {
  it('applies a partial update and bumps updatedAt; no-op for unknown id', () => {
    webInsertFinancialGoal(fgoal({ id: 'fg1', monthlySavings: 100, updatedAt: '2026-01-01T00:00:00.000Z' }));
    webUpdateFinancialGoal('fg1', { monthlySavings: 250 });
    const after = webGetFinancialGoalById('fg1');
    expect(after?.monthlySavings).toBe(250);
    expect(after?.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');

    webUpdateFinancialGoal('missing', { monthlySavings: 999 });
    expect(webGetFinancialGoalById('fg1')?.monthlySavings).toBe(250);
  });
});

describe('milestones', () => {
  it('lists by goal, completes by id, and cascade-deletes by goal', () => {
    webInsertMilestone(milestone({ id: 'm1', goalId: 'fg1' }));
    webInsertMilestone(milestone({ id: 'm2', goalId: 'fg1' }));
    webInsertMilestone(milestone({ id: 'm3', goalId: 'fg2' }));
    expect(webGetMilestonesByGoal('fg1').map((m) => m.id).sort()).toEqual(['m1', 'm2']);

    webCompleteMilestone('m1');
    expect(webGetMilestonesByGoal('fg1').find((m) => m.id === 'm1')?.completedAt).toBeDefined();

    webDeleteMilestonesByGoal('fg1');
    expect(webGetMilestonesByGoal('fg1')).toHaveLength(0);
    expect(webGetMilestonesByGoal('fg2').map((m) => m.id)).toEqual(['m3']);
  });
});
