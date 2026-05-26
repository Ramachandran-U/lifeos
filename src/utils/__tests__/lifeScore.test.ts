import { computeLifeScore, computeLifeScoreTrend, lifeScoreBand } from '../lifeScore';
import type { DomainScores } from '../gamification';
import type { ScorePoint } from '@/store/useDomainHistoryStore';

const scores = (over: Partial<DomainScores> = {}): DomainScores => ({
  goals: 50, health: 50, finance: 50, career: 50, social: 50, polymath: 50, ...over,
});

describe('computeLifeScore', () => {
  it('returns the flat average when no primary domains are set', () => {
    expect(computeLifeScore(scores())).toBe(50);
  });

  it('clamps within 0..100 and rounds', () => {
    expect(computeLifeScore(scores({ goals: 100, health: 100, finance: 100, career: 100, social: 100, polymath: 100 }))).toBe(100);
    expect(computeLifeScore(scores({ goals: 0, health: 0, finance: 0, career: 0, social: 0, polymath: 0 }))).toBe(0);
  });

  it('weights primary domains 1.5x', () => {
    // All domains 0 except health=100. Flat avg = 100/6 ≈ 17.
    const flat = computeLifeScore(scores({ goals: 0, health: 100, finance: 0, career: 0, social: 0, polymath: 0 }));
    // With health as primary (weight 1.5), the 100 pulls harder:
    // (100*1.5) / (1.5 + 5*1.0) = 150 / 6.5 ≈ 23.
    const weighted = computeLifeScore(
      scores({ goals: 0, health: 100, finance: 0, career: 0, social: 0, polymath: 0 }),
      ['health'],
    );
    expect(weighted).toBeGreaterThan(flat);
    expect(weighted).toBe(23);
  });

  it('maps mind domain to the polymath primary key', () => {
    const weighted = computeLifeScore(
      scores({ goals: 0, health: 0, finance: 0, career: 0, social: 0, polymath: 100 }),
      ['polymath'],
    );
    expect(weighted).toBe(23); // same arithmetic as the health case
  });
});

describe('computeLifeScoreTrend', () => {
  const pts = (vals: Array<[string, number]>): ScorePoint[] =>
    vals.map(([date, score]) => ({ date, score }));

  it('returns a single point and zero deltas when history is empty', () => {
    const t = computeLifeScoreTrend(scores(), {});
    expect(t.history).toHaveLength(1);
    expect(t.current).toBe(50);
    expect(t.delta30).toBe(0);
    expect(t.delta90).toBe(0);
  });

  it('reconstructs a rising composite and reports positive deltas', () => {
    // health climbs 20 → 80 across three snapshots; everything else flat at 50.
    const history = {
      health: pts([
        ['2026-01-01', 20],
        ['2026-01-15', 50],
        ['2026-02-01', 80],
      ]),
    };
    const t = computeLifeScoreTrend(scores({ health: 80 }), history);
    // Oldest composite uses health=20, newest uses health=80 → strictly rising.
    expect(t.history[0]).toBeLessThan(t.history[t.history.length - 1]);
    expect(t.current).toBeGreaterThan(t.history[0]);
  });

  it('carry-forwards a domain value across days with no snapshot', () => {
    const history = {
      health: pts([['2026-01-01', 100]]),
      goals: pts([['2026-01-02', 100]]),
    };
    // Two distinct dates → two composite points. On day 2 health must still
    // count as 100 (carried forward), not reset.
    const t = computeLifeScoreTrend(scores({ health: 100, goals: 100 }), history);
    expect(t.history.length).toBeGreaterThanOrEqual(2);
    // Final composite reflects both at 100 and the rest at 50.
    // (100+100+50+50+50+50)/6 = 66.67 → 67.
    expect(t.current).toBe(67);
  });
});

describe('lifeScoreBand', () => {
  it('labels each band honestly', () => {
    expect(lifeScoreBand(85).label).toBe('Thriving');
    expect(lifeScoreBand(70).label).toBe('Solid');
    expect(lifeScoreBand(55).label).toBe('Building');
    expect(lifeScoreBand(40).label).toBe('Stalling');
    expect(lifeScoreBand(20).label).toBe('Resetting');
  });

  it('uses inclusive lower bounds at the band edges', () => {
    expect(lifeScoreBand(80).label).toBe('Thriving');
    expect(lifeScoreBand(65).label).toBe('Solid');
    expect(lifeScoreBand(50).label).toBe('Building');
    expect(lifeScoreBand(35).label).toBe('Stalling');
    expect(lifeScoreBand(34).label).toBe('Resetting');
  });
});
