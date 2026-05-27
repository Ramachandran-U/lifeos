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

  it('counts nested descendants and collects lagging titles', () => {
    const monthly = goal({ id: 'm1', parentId: 'life', status: 'completed', title: 'Month 1' });
    const weekly = goal({ id: 'w1', parentId: 'm1', status: 'active', title: 'Week 1' });
    const t = computeTrajectory(life, [life, monthly, weekly], new Date('2026-02-01'));
    expect(t.totalSubGoals).toBe(2);
    expect(t.completedSubGoals).toBe(1);
    expect(t.laggingTitles).toContain('Week 1');
  });
});

describe('quarterKey', () => {
  it('labels calendar quarters', () => {
    expect(quarterKey(new Date('2026-01-15'))).toBe('2026-Q1');
    expect(quarterKey(new Date('2026-05-27'))).toBe('2026-Q2');
    expect(quarterKey(new Date('2026-12-31'))).toBe('2026-Q4');
  });
});
