import { recommendFromVerdict, pickVariant } from '../variantPolicy';
import type { Verdict } from '../productionOutcomes';

describe('recommendFromVerdict', () => {
  it('recommends single-shot (urgent) on a kill verdict', () => {
    const v: Verdict = { state: 'kill_agent', deltaPctPoints: -0.08 };
    const r = recommendFromVerdict(v);
    expect(r.recommend).toBe('single_shot');
    expect(r.urgent).toBe(true);
    expect(r.note).toMatch(/8\.0 pts/);
  });

  it('recommends keeping the agent on a keep verdict', () => {
    const r = recommendFromVerdict({ state: 'keep_agent', deltaPctPoints: 0.05 });
    expect(r.recommend).toBe('agent');
    expect(r.urgent).toBe(false);
  });

  it('defaults to agent (non-urgent) on no_signal and insufficient_data', () => {
    expect(recommendFromVerdict({ state: 'no_signal', deltaPctPoints: 0.01 }).recommend).toBe('agent');
    const insufficient = recommendFromVerdict({ state: 'insufficient_data', reason: 'too few' });
    expect(insufficient.recommend).toBe('agent');
    expect(insufficient.urgent).toBe(false);
  });
});

describe('pickVariant', () => {
  it('defaults to agent with no override', () => {
    expect(pickVariant('routine.generate')).toBe('agent');
  });

  it('honours an explicit human override (no auto-flip)', () => {
    expect(pickVariant('routine.generate', { override: 'single_shot' })).toBe('single_shot');
  });

  it('uses the provided default when no override is set', () => {
    expect(pickVariant('routine.generate', { default: 'single_shot' })).toBe('single_shot');
  });

  it('override beats default', () => {
    expect(pickVariant('routine.generate', { override: 'agent', default: 'single_shot' })).toBe('agent');
  });
});
