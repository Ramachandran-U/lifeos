import { runConsolidation, ConsolidatedFactsSchema, type ConsolidateDeps, type ConsolidatedFact } from '../memory/consolidate';

function harness(over: Partial<ConsolidateDeps> = {}) {
  const upserted: ConsolidatedFact[] = [];
  const deps: ConsolidateDeps = {
    gatherSignal: () => '3× block_completed\nReflection 2026-05-29: mood 4/5',
    consolidate: async () => [
      { kind: 'pattern', text: 'They complete morning blocks.' },
      { kind: 'milestone', text: 'They hit a 30-day streak.' },
    ],
    upsert: async (f) => {
      upserted.push(f);
    },
    ...over,
  };
  return { upserted, deps };
}

describe('runConsolidation', () => {
  it('summarises the window and upserts each fact', async () => {
    const { upserted, deps } = harness();
    const res = await runConsolidation(deps);
    expect(res.written).toBe(2);
    expect(upserted).toHaveLength(2);
    expect(upserted[0].kind).toBe('pattern');
  });

  it('skips entirely when there is no signal (no AI call, no writes)', async () => {
    const consolidate = jest.fn();
    const { upserted, deps } = harness({ gatherSignal: () => '   ', consolidate });
    const res = await runConsolidation(deps);
    expect(res).toEqual({ written: 0, facts: [] });
    expect(consolidate).not.toHaveBeenCalled();
    expect(upserted).toHaveLength(0);
  });

  it('writes nothing when the summariser returns no facts', async () => {
    const { upserted, deps } = harness({ consolidate: async () => [] });
    const res = await runConsolidation(deps);
    expect(res.written).toBe(0);
    expect(upserted).toHaveLength(0);
  });

  it('skips facts the user has suppressed, so "forget" sticks', async () => {
    const { upserted, deps } = harness({
      // Pretend the streak milestone was deleted previously → tombstoned.
      shouldSuppress: async (f) => f.kind === 'milestone',
    });
    const res = await runConsolidation(deps);
    expect(res.written).toBe(1);
    expect(res.facts.map((f) => f.kind)).toEqual(['pattern']);
    expect(upserted.map((f) => f.kind)).toEqual(['pattern']);
  });
});

describe('ConsolidatedFactsSchema', () => {
  it('accepts valid facts', () => {
    const parsed = ConsolidatedFactsSchema.parse({
      facts: [{ kind: 'preference', text: 'They prefer early mornings.' }],
    });
    expect(parsed.facts).toHaveLength(1);
  });

  it('rejects an unknown kind', () => {
    expect(() => ConsolidatedFactsSchema.parse({ facts: [{ kind: 'vibe', text: 'x' }] })).toThrow();
  });

  it('caps the number of facts at 5', () => {
    const six = { facts: Array.from({ length: 6 }, () => ({ kind: 'pattern', text: 'x' })) };
    expect(() => ConsolidatedFactsSchema.parse(six)).toThrow();
  });
});
