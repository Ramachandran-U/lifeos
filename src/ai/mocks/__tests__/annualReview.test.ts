import { buildMockAnnualReview } from '../annualReview';
import { AnnualReviewSchema, type AnnualReviewInput } from '../../types';

const base: AnnualReviewInput = {
  windowDays: 365,
  name: 'Alex',
  goals: { total: 5, completed: 2 },
  routine: { blocksPlanned: 200, blocksCompleted: 150, completionRate: 0.75 },
  domainMinutes: { health: 6000, career: 3000, social: 600 },
  lifeScore: { current: 62, start: 50 },
  topStreaks: [{ key: 'workout', count: 40 }],
  totalXP: 4200,
  badgeCount: 7,
  social: { contacts: 12, inCadencePct: 70 },
};

describe('buildMockAnnualReview', () => {
  it('produces a schema-valid review', () => {
    const out = buildMockAnnualReview(base);
    expect(() => AnnualReviewSchema.parse(out)).not.toThrow();
  });

  it('celebrates a positive life-score delta', () => {
    const out = buildMockAnnualReview(base);
    expect(out.headline).toContain('up 12');
  });

  it('ranks domains by minutes and caps at 6', () => {
    const out = buildMockAnnualReview(base);
    expect(out.domains[0].domain).toBe('Health');
    expect(out.domains.length).toBeLessThanOrEqual(6);
  });

  it('flags follow-through when completion is low', () => {
    const out = buildMockAnnualReview({ ...base, routine: { ...base.routine, completionRate: 0.4 } });
    expect(out.growthArea.toLowerCase()).toContain('follow-through');
  });

  it('handles an empty year without crashing', () => {
    const out = buildMockAnnualReview({
      ...base,
      goals: { total: 0, completed: 0 },
      domainMinutes: {},
      topStreaks: [],
      lifeScore: { current: 50, start: 50 },
    });
    expect(() => AnnualReviewSchema.parse(out)).not.toThrow();
  });
});
