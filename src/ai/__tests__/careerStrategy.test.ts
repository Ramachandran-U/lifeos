import { CareerStrategySchema, MotivationSchema } from '../types';
import { buildMockCareerStrategy, buildMockMotivation } from '../mocks/career';

describe('CareerStrategySchema', () => {
  it('validates the mock output', () => {
    const result = buildMockCareerStrategy({
      currentRole: 'Data Analyst',
      targetRole: 'ML Engineer',
      currentSkills: ['Python', 'SQL'],
      timeframeWeeks: 12,
      weeklyHours: 10,
    });
    expect(() => CareerStrategySchema.parse(result)).not.toThrow();
    expect(result.phases).toHaveLength(3);
    expect(result.phases.map((p) => p.name)).toEqual(['Foundation', 'Build', 'Proof']);
    expect(result.weeklyOutput.length).toBe(12);
    expect(result.skillGaps.length).toBeGreaterThanOrEqual(5);
    expect(result.dailyPlan.deepWork.length).toBeGreaterThanOrEqual(2);
    expect(result.failurePoints.length).toBeGreaterThanOrEqual(4);
    expect(result.mvs.metric).toBeTruthy();
  });

  it('rejects invalid phase count', () => {
    const bad = {
      realityCheck: 'x',
      skillGaps: [],
      phases: [
        { name: 'Foundation', weeks: '1-4', focus: 'f', milestones: ['m'] },
      ],
      dailyPlan: { deepWork: [], build: [], review: [] },
      weeklyOutput: [],
      failurePoints: [],
      mvs: { metric: 'm', outcome: 'o' },
    };
    expect(() => CareerStrategySchema.parse(bad)).toThrow();
  });

  it('rejects invalid skill priority', () => {
    const strat = buildMockCareerStrategy({
      currentRole: 'A', targetRole: 'B', currentSkills: [], timeframeWeeks: 6, weeklyHours: 5,
    });
    const mutated = { ...strat, skillGaps: [{ ...strat.skillGaps[0], priority: 'critical' }] };
    expect(() => CareerStrategySchema.parse(mutated)).toThrow();
  });
});

describe('MotivationSchema (strategist tone)', () => {
  it('validates the mock output', () => {
    const m = buildMockMotivation({ module: 'goals', context: 'weight loss' });
    expect(() => MotivationSchema.parse(m)).not.toThrow();
    expect(m.quote.length).toBeGreaterThan(0);
    expect(m.microTip.length).toBeGreaterThan(0);
  });

  it('contextualises the quote to the input', () => {
    const m = buildMockMotivation({ module: 'career', context: 'moving to ML Engineer' });
    expect(m.quote.toLowerCase()).toContain('moving');
  });
});
