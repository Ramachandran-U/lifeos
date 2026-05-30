import {
  rebalanceGoals,
  GoalRebalanceSchema,
  detectDomainDivergence,
  STARVE_RATIO,
  MIN_TRACKED_MINUTES,
  type GoalRebalanceInput,
  type DivergenceDeps,
} from '../goalRebalance';

const INPUT: GoalRebalanceInput = {
  goals: [
    { id: 'g1', title: 'Ship app', type: 'career', currentProgress: 0.2, weeklyHoursAllocated: 10 },
    { id: 'g2', title: 'Run 10k', type: 'health', currentProgress: 0.8, weeklyHoursAllocated: 3 },
  ],
  totalAvailableHours: 15,
};

describe('rebalanceGoals (mock)', () => {
  beforeEach(() => {
    process.env.USE_AI_MOCK = 'true';
  });
  afterEach(() => {
    delete process.env.USE_AI_MOCK;
    delete process.env.EXPO_PUBLIC_USE_AI_MOCK;
  });

  it('returns a proposal with one suggestion per goal', async () => {
    const proposal = await rebalanceGoals(INPUT);
    expect(proposal).not.toBeNull();
    expect(proposal!.suggestions.map((s) => s.goalId).sort()).toEqual(['g1', 'g2']);
    expect(proposal!.insight.length).toBeGreaterThan(0);
  });

  it('returns null for no goals (nothing to rebalance)', async () => {
    expect(await rebalanceGoals({ goals: [], totalAvailableHours: 10 })).toBeNull();
  });
});

describe('GoalRebalanceSchema', () => {
  it('accepts a well-formed proposal', () => {
    expect(() =>
      GoalRebalanceSchema.parse({
        suggestions: [{ goalId: 'g1', weeklyHours: 8, reason: 'behind schedule' }],
        insight: 'shift time to the lagging goal',
      }),
    ).not.toThrow();
  });

  it('rejects negative hours', () => {
    expect(() =>
      GoalRebalanceSchema.parse({
        suggestions: [{ goalId: 'g1', weeklyHours: -1, reason: 'x' }],
        insight: 'y',
      }),
    ).toThrow();
  });
});

describe('detectDomainDivergence', () => {
  function deps(over: Partial<DivergenceDeps> = {}): DivergenceDeps {
    return {
      primaryDomains: ['career', 'health', 'social'],
      actualMinutesByDomain: { career: 300, health: 280, social: 20 },
      cooldownOk: () => true,
      ...over,
    };
  }

  it('flags a starved primary domain (below half its fair share)', () => {
    // fair share = 1/3 ≈ 0.333; social = 20/600 ≈ 0.033, well below 0.167
    const c = detectDomainDivergence(deps())!;
    expect(c.domain).toBe('social');
    expect(c.actualShare).toBeLessThan(c.fairShare * STARVE_RATIO);
  });

  it('stays silent when every domain is near its fair share', () => {
    expect(
      detectDomainDivergence(deps({ actualMinutesByDomain: { career: 200, health: 200, social: 200 } })),
    ).toBeNull();
  });

  it('stays silent below the minimum tracked minutes', () => {
    expect(
      detectDomainDivergence(deps({ actualMinutesByDomain: { career: MIN_TRACKED_MINUTES - 60, health: 30, social: 0 } })),
    ).toBeNull();
  });

  it('stays silent during cooldown', () => {
    expect(detectDomainDivergence(deps({ cooldownOk: () => false }))).toBeNull();
  });

  it('returns the most-starved when several qualify', () => {
    const c = detectDomainDivergence(
      deps({ actualMinutesByDomain: { career: 560, health: 30, social: 10 } }),
    )!;
    expect(c.domain).toBe('social'); // 10/600 < 30/600
  });
});
