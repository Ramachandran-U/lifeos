import {
  isValidExpedition,
  buildMockExpedition,
  generateExpedition,
  MIN_STEPS,
  MAX_STEPS,
  type GeneratedExpedition,
} from '../expeditionGen';
import type { ExpeditionStep } from '../expeditions';

function step(over: Partial<ExpeditionStep> = {}): ExpeditionStep {
  return { index: 0, title: 'Map the landscape', kind: 'read', prompt: 'Spend 15 minutes writing what you believe.', estMinutes: 15, ...over };
}
function exp(steps: ExpeditionStep[], over: Partial<GeneratedExpedition> = {}): GeneratedExpedition {
  return { title: 'Seven days into jazz', theme: 'jazz', steps, ...over };
}
const fiveValid = () => Array.from({ length: 5 }, (_, i) => step({ index: i, kind: i === 4 ? 'do' : 'read' }));

describe('isValidExpedition', () => {
  it('accepts a well-formed 5-7 step journey', () => {
    expect(isValidExpedition(exp(fiveValid()))).toBe(true);
  });
  it('rejects too few / too many steps', () => {
    expect(isValidExpedition(exp(fiveValid().slice(0, MIN_STEPS - 1)))).toBe(false);
    expect(isValidExpedition(exp(Array.from({ length: MAX_STEPS + 1 }, (_, i) => step({ index: i }))))).toBe(false);
  });
  it('rejects invalid step kinds', () => {
    const s = fiveValid(); s[0] = step({ kind: 'ponder' as never });
    expect(isValidExpedition(exp(s))).toBe(false);
  });
  it('rejects out-of-range durations', () => {
    const s = fiveValid(); s[1] = step({ index: 1, estMinutes: 90 });
    expect(isValidExpedition(exp(s))).toBe(false);
  });
  it('rejects thin prompts', () => {
    const s = fiveValid(); s[2] = step({ index: 2, prompt: 'go' });
    expect(isValidExpedition(exp(s))).toBe(false);
  });
  it('rejects reflect-filler (more than one reflect step)', () => {
    const s = fiveValid(); s[0] = step({ kind: 'reflect' }); s[1] = step({ index: 1, kind: 'reflect' });
    expect(isValidExpedition(exp(s))).toBe(false);
  });
});

describe('buildMockExpedition', () => {
  it('produces a valid, seed-grounded journey', () => {
    const e = buildMockExpedition({ seedInterest: 'jazz' });
    expect(isValidExpedition(e)).toBe(true);
    expect(e.theme).toBe('jazz');
    expect(e.steps[0]!.index).toBe(0);
    expect(e.steps.every((s, i) => s.index === i)).toBe(true);
  });
  it('handles a bare theme gracefully', () => {
    expect(isValidExpedition(buildMockExpedition({}))).toBe(true);
  });
});

describe('generateExpedition (mock mode)', () => {
  const prev = process.env.USE_AI_MOCK;
  beforeAll(() => { process.env.USE_AI_MOCK = 'true'; });
  afterAll(() => { process.env.USE_AI_MOCK = prev; });

  it('returns a valid journey without the network', async () => {
    const e = await generateExpedition({ seedSparkTitle: 'The hidden grammar of chess' });
    expect(isValidExpedition(e)).toBe(true);
    expect(e.steps.length).toBeGreaterThanOrEqual(MIN_STEPS);
  });
});
