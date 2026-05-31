import { computeTrajectory, parseHorizonMonths, quarterKey, type TrajectoryGoal } from '../trajectory';

function goal(p: Partial<TrajectoryGoal> & Pick<TrajectoryGoal, 'id'>): TrajectoryGoal {
  return {
    parentId: null,
    level: 'monthly',
    status: 'active',
    title: p.id,
    timeline: null,
    createdAt: '2026-01-01',
    ...p,
  };
}

describe('parseHorizonMonths', () => {
  it('defaults to 36 months', () => {
    expect(parseHorizonMonths(null)).toBe(36);
    expect(parseHorizonMonths('someday')).toBe(36);
  });
  it('reads years', () => {
    expect(parseHorizonMonths('3 years')).toBe(36);
    expect(parseHorizonMonths('5-year plan')).toBe(60);
  });
  it('reads months', () => {
    expect(parseHorizonMonths('18 months')).toBe(18);
  });
});

describe('computeTrajectory', () => {
  const life = goal({ id: 'life', level: 'life', timeline: '3 years', createdAt: '2026-01-01' });

  it('reports no_data when the tree has no sub-goals', () => {
    const t = computeTrajectory(life, [life], new Date('2026-07-01'));
    expect(t.status).toBe('no_data');
    expect(t.totalSubGoals).toBe(0);
  });

  it('flags behind when little is done but time has passed', () => {
    // ~18 of 36 months elapsed (50% expected), but 0/4 done.
    const subs = [1, 2, 3, 4].map((n) => goal({ id: `s${n}`, parentId: 'life' }));
    const t = computeTrajectory(life, [life, ...subs], new Date('2027-07-01'));
    expect(t.expectedProgress).toBeGreaterThan(0.4);
    expect(t.actualProgress).toBe(0);
    expect(t.status).toBe('behind');
    expect(t.deltaPct).toBeLessThan(0);
  });

  it('flags ahead when most is done early', () => {
    const subs = [1, 2, 3, 4].map((n) => goal({ id: `s${n}`, parentId: 'life', status: 'completed' }));
    const t = computeTrajectory(life, [life, ...subs], new Date('2026-04-01'));
    expect(t.actualProgress).toBe(1);
    expect(t.status).toBe('ahead');
  });

  it('counts only milestone levels (yearly/monthly), never weekly/daily tasks', () => {
    const m1 = goal({ id: 'm1', parentId: 'life', level: 'monthly', status: 'completed', title: 'Month 1' });
    const m2 = goal({ id: 'm2', parentId: 'life', level: 'monthly', status: 'active', title: 'Month 2' });
    const w1 = goal({ id: 'w1', parentId: 'm1', level: 'weekly', status: 'active', title: 'Week 1' });
    const d1 = goal({ id: 'd1', parentId: 'w1', level: 'daily', status: 'active', title: 'Day 1' });
    const t = computeTrajectory(life, [life, m1, m2, w1, d1], new Date('2026-06-01'));
    // Only m1 + m2 count; the weekly + daily tasks are excluded.
    expect(t.totalSubGoals).toBe(2);
    expect(t.completedSubGoals).toBe(1);
    expect(t.laggingTitles).toContain('Month 2');
    expect(t.laggingTitles).not.toContain('Week 1');
    expect(t.laggingTitles).not.toContain('Day 1');
  });
});

describe('computeTrajectory — horizon default flag', () => {
  it('marks horizon as default when no timeline is set', () => {
    const life = goal({ id: 'life', level: 'life', timeline: null, createdAt: '2026-01-01' });
    const sub = goal({ id: 'm1', parentId: 'life', level: 'monthly' });
    const t = computeTrajectory(life, [life, sub], new Date('2026-08-01'));
    expect(t.horizonIsDefault).toBe(true);
    expect(t.horizonMonths).toBe(36);
  });

  it('uses the user-set horizon and is not default', () => {
    const life = goal({ id: 'life', level: 'life', timeline: '1 year', createdAt: '2026-01-01' });
    const sub = goal({ id: 'm1', parentId: 'life', level: 'monthly' });
    const t = computeTrajectory(life, [life, sub], new Date('2026-08-01'));
    expect(t.horizonIsDefault).toBe(false);
    expect(t.horizonMonths).toBe(12);
  });
});

describe('computeTrajectory — justStarted', () => {
  it('is true in the opening window with nothing completed', () => {
    const life = goal({ id: 'life', level: 'life', timeline: '1 year', createdAt: '2026-01-01' });
    const sub = goal({ id: 'm1', parentId: 'life', level: 'monthly', status: 'active' });
    const t = computeTrajectory(life, [life, sub], new Date('2026-01-05'));
    expect(t.justStarted).toBe(true);
  });

  it('is false once a milestone is completed', () => {
    const life = goal({ id: 'life', level: 'life', timeline: '1 year', createdAt: '2026-01-01' });
    const sub = goal({ id: 'm1', parentId: 'life', level: 'monthly', status: 'completed' });
    const t = computeTrajectory(life, [life, sub], new Date('2026-01-05'));
    expect(t.justStarted).toBe(false);
  });

  it('is false once more than a month has elapsed', () => {
    const life = goal({ id: 'life', level: 'life', timeline: '1 year', createdAt: '2026-01-01' });
    const sub = goal({ id: 'm1', parentId: 'life', level: 'monthly', status: 'active' });
    const t = computeTrajectory(life, [life, sub], new Date('2026-03-01'));
    expect(t.justStarted).toBe(false);
  });
});

describe('quarterKey', () => {
  it('labels calendar quarters', () => {
    expect(quarterKey(new Date('2026-01-15'))).toBe('2026-Q1');
    expect(quarterKey(new Date('2026-05-27'))).toBe('2026-Q2');
    expect(quarterKey(new Date('2026-12-31'))).toBe('2026-Q4');
  });
});
