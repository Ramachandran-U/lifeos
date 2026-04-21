/**
 * Regression test for the "empty Goals tab" bug: the AI-generated hierarchy
 * was displayed but never persisted. This verifies every level of the tree
 * makes it to createGoal with correct parent chains.
 */
import { persistHierarchy } from '../persistHierarchy';
import type { GoalHierarchy } from '@/ai/types';

const SAMPLE: GoalHierarchy = {
  primaryGoal: { title: 'Become a product leader', type: 'career' },
  yearly: { title: 'Ship first product', milestone: 'Launch v1 by Dec' },
  monthly: [
    { month: 1, title: 'Research', milestone: 'Interview 10 users' },
    { month: 2, title: 'Prototype', milestone: 'Clickable demo' },
    { month: 3, title: 'Build', milestone: 'MVP shipped' },
  ],
  weekly: [
    { week: 1, focus: 'Discovery', tasks: ['Book interviews', 'Write script'] },
    { week: 2, focus: 'Synthesis', tasks: ['Affinity map'] },
  ],
  dailyTaskExamples: ['Read 20 pages', 'Send 1 outreach email', 'Journal 10 min'],
};

describe('persistHierarchy (regression: empty Goals tab)', () => {
  type Call = Parameters<Parameters<typeof persistHierarchy>[2]>[0];

  const makeSpy = () => {
    const calls: Call[] = [];
    let counter = 0;
    const fn = (data: Call) => {
      calls.push(data);
      return `id-${++counter}`;
    };
    return { fn, calls };
  };

  it('persists exactly one life goal', () => {
    const { fn, calls } = makeSpy();
    persistHierarchy('user-1', SAMPLE, fn);
    const life = calls.filter((c) => c.level === 'life');
    expect(life).toHaveLength(1);
    expect(life[0]).toMatchObject({
      userId: 'user-1',
      title: SAMPLE.primaryGoal.title,
      goalType: 'career',
      aiGenerated: true,
    });
    expect(life[0].parentId).toBeUndefined();
  });

  it('chains yearly → life', () => {
    const { fn, calls } = makeSpy();
    const result = persistHierarchy('user-1', SAMPLE, fn);
    const yearly = calls.find((c) => c.level === 'yearly')!;
    expect(yearly.parentId).toBe(result.lifeId);
    expect(yearly.title).toBe(SAMPLE.yearly.title);
    expect(yearly.description).toBe(SAMPLE.yearly.milestone);
  });

  it('chains all monthly goals → yearly and preserves metadata', () => {
    const { fn, calls } = makeSpy();
    const result = persistHierarchy('user-1', SAMPLE, fn);
    const monthly = calls.filter((c) => c.level === 'monthly');
    expect(monthly).toHaveLength(3);
    monthly.forEach((m) => expect(m.parentId).toBe(result.yearlyId));
    expect(JSON.parse(monthly[0].metadata!)).toEqual({ month: 1 });
  });

  it('chains weekly → first monthly and stores tasks in metadata', () => {
    const { fn, calls } = makeSpy();
    const result = persistHierarchy('user-1', SAMPLE, fn);
    const weekly = calls.filter((c) => c.level === 'weekly');
    expect(weekly).toHaveLength(2);
    weekly.forEach((w) => expect(w.parentId).toBe(result.monthlyIds[0]));
    expect(JSON.parse(weekly[0].metadata!).tasks).toEqual(['Book interviews', 'Write script']);
  });

  it('chains daily tasks → first weekly', () => {
    const { fn, calls } = makeSpy();
    const result = persistHierarchy('user-1', SAMPLE, fn);
    const daily = calls.filter((c) => c.level === 'daily');
    expect(daily).toHaveLength(3);
    daily.forEach((d) => expect(d.parentId).toBe(result.weeklyIds[0]));
    expect(daily.map((d) => d.title)).toEqual(SAMPLE.dailyTaskExamples);
  });

  it('persists the full tree in one call (life + yearly + 3 monthly + 2 weekly + 3 daily = 10)', () => {
    const { fn, calls } = makeSpy();
    persistHierarchy('user-1', SAMPLE, fn);
    expect(calls).toHaveLength(10);
  });

  it('falls back to yearly as weekly parent when monthly is empty', () => {
    const { fn, calls } = makeSpy();
    const noMonthly: GoalHierarchy = { ...SAMPLE, monthly: [] };
    const result = persistHierarchy('user-1', noMonthly, fn);
    const weekly = calls.filter((c) => c.level === 'weekly');
    weekly.forEach((w) => expect(w.parentId).toBe(result.yearlyId));
  });

  it('falls back to yearly as daily parent when weekly is empty', () => {
    const { fn, calls } = makeSpy();
    const noWeekly: GoalHierarchy = { ...SAMPLE, weekly: [] };
    const result = persistHierarchy('user-1', noWeekly, fn);
    const daily = calls.filter((c) => c.level === 'daily');
    daily.forEach((d) => expect(d.parentId).toBe(result.yearlyId));
  });
});
