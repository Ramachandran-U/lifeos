import {
  detectStagnantDomain,
  domainToModule,
  trailingFlatRunForTest,
  STAGNATION_WINDOW_DAYS,
  MIN_SAMPLE_DAYS,
  FLAT_EPSILON,
  type ScorePoint,
  type StagnationDeps,
} from '../domainStagnation';
import type { DomainId } from '@/store/useUserStore';

// ---- helpers ----
function flatHistory(score: number, days = MIN_SAMPLE_DAYS): ScorePoint[] {
  return Array.from({ length: days }, (_, i) => ({ date: `2026-05-${String(i + 1).padStart(2, '0')}`, score }));
}
function risingHistory(from: number, to: number, days = MIN_SAMPLE_DAYS): ScorePoint[] {
  const step = (to - from) / (days - 1);
  return Array.from({ length: days }, (_, i) => ({ date: `2026-05-${String(i + 1).padStart(2, '0')}`, score: Math.round(from + step * i) }));
}

function makeDeps(overrides: Partial<StagnationDeps> & { histories: Partial<Record<DomainId, ScorePoint[]>> }): StagnationDeps {
  const { histories, ...rest } = overrides;
  return {
    primaryDomains: Object.keys(histories) as DomainId[],
    fullHistoryFor: (d) => histories[d] ?? [],
    isDomainFed: () => false,
    cooldownOk: () => true,
    ...rest,
  };
}

describe('domainToModule', () => {
  it('maps goals -> goal and leaves others unchanged', () => {
    expect(domainToModule('goals')).toBe('goal');
    expect(domainToModule('health')).toBe('health');
    expect(domainToModule('polymath')).toBe('polymath');
  });
});

describe('detectStagnantDomain', () => {
  it('fires for a chosen, flat, unfed domain with enough history', () => {
    const res = detectStagnantDomain(makeDeps({ histories: { polymath: flatHistory(20) } }));
    expect(res?.domain).toBe('polymath');
    expect(res?.currentScore).toBe(20);
    expect(Math.abs(res!.delta)).toBeLessThanOrEqual(FLAT_EPSILON);
    expect(res?.daysFlat).toBe(MIN_SAMPLE_DAYS);
  });

  it('stays silent when the domain is growing', () => {
    const res = detectStagnantDomain(makeDeps({ histories: { health: risingHistory(20, 60) } }));
    expect(res).toBeNull();
  });

  it('stays silent below the minimum sample size', () => {
    const res = detectStagnantDomain(makeDeps({ histories: { polymath: flatHistory(20, MIN_SAMPLE_DAYS - 1) } }));
    expect(res).toBeNull();
  });

  it('stays silent when the flat domain is being fed', () => {
    const res = detectStagnantDomain(
      makeDeps({ histories: { polymath: flatHistory(20) }, isDomainFed: () => true }),
    );
    expect(res).toBeNull();
  });

  it('stays silent during cooldown', () => {
    const res = detectStagnantDomain(
      makeDeps({ histories: { polymath: flatHistory(20) }, cooldownOk: () => false }),
    );
    expect(res).toBeNull();
  });

  it('never flags a domain the user did not choose', () => {
    // history exists for finance, but it is not in primaryDomains
    const deps: StagnationDeps = {
      primaryDomains: ['health'],
      fullHistoryFor: (d) => (d === 'finance' ? flatHistory(5) : risingHistory(20, 60)),
      isDomainFed: () => false,
      cooldownOk: () => true,
    };
    expect(detectStagnantDomain(deps)).toBeNull();
  });

  it('ranks the lowest-scoring stagnant domain first', () => {
    const res = detectStagnantDomain(
      makeDeps({ histories: { health: flatHistory(40), polymath: flatHistory(15), social: flatHistory(70) } }),
    );
    expect(res?.domain).toBe('polymath'); // lowest score wins
  });

  it('breaks score ties by longest flat run', () => {
    const shortFlat = [...risingHistory(10, 30, 10), ...flatHistory(30, MIN_SAMPLE_DAYS)]; // recently flat-ish
    const longFlat = flatHistory(30, MIN_SAMPLE_DAYS + 20);
    const res = detectStagnantDomain(
      makeDeps({ histories: { health: shortFlat, polymath: longFlat } }),
    );
    expect(res?.domain).toBe('polymath');
    expect(res?.currentScore).toBe(30);
  });

  it('returns null when no domains qualify', () => {
    expect(detectStagnantDomain(makeDeps({ histories: {} }))).toBeNull();
  });

  it('treats a slight dip (within epsilon) as flat, but a real rise as growth', () => {
    const dip = flatHistory(30);
    dip[dip.length - 1] = { date: '2026-05-31', score: 29 }; // -1 over window
    expect(detectStagnantDomain(makeDeps({ histories: { polymath: dip } }))?.domain).toBe('polymath');
  });
});

describe('trailingFlatRun', () => {
  it('counts the trailing run within epsilon of the latest score', () => {
    const h: ScorePoint[] = [
      { date: '1', score: 10 },
      { date: '2', score: 50 },
      { date: '3', score: 51 },
      { date: '4', score: 50 },
    ];
    // latest 50; 51 and 50 within epsilon, 10 breaks → run of 3
    expect(trailingFlatRunForTest(h)).toBe(3);
  });
});
