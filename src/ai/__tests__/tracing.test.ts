import { startSpan, endSpan, withSpan, getSpans, clearSpans, summarizeTrace } from '../tracing';

describe('tracing', () => {
  beforeEach(() => clearSpans());

  test('start/end records duration and status', async () => {
    const s = startSpan('foo');
    await new Promise((r) => setTimeout(r, 5));
    endSpan(s);
    const all = getSpans();
    expect(all.length).toBe(1);
    expect(all[0]!.name).toBe('foo');
    expect(all[0]!.durationMs).toBeGreaterThanOrEqual(0);
    expect(all[0]!.status).toBe('ok');
  });

  test('withSpan: nests parentId correctly', async () => {
    await withSpan('outer', async () => {
      await withSpan('inner', async () => 'x');
      await withSpan('inner2', async () => 'y');
    });
    const all = getSpans();
    expect(all.length).toBe(3);
    const outer = all.find((s) => s.name === 'outer')!;
    const inner = all.find((s) => s.name === 'inner')!;
    const inner2 = all.find((s) => s.name === 'inner2')!;
    expect(outer.parentId).toBeUndefined();
    expect(inner.parentId).toBe(outer.id);
    expect(inner2.parentId).toBe(outer.id);
  });

  test('withSpan: error closes span and rethrows', async () => {
    await expect(
      withSpan('boom', async () => {
        throw new Error('explode');
      }),
    ).rejects.toThrow('explode');
    const all = getSpans();
    expect(all[0]!.status).toBe('error');
    expect(all[0]!.error).toBe('explode');
    expect(all[0]!.endMs).toBeDefined();
  });

  test('summarizeTrace: aggregates by name and counts errors', async () => {
    await withSpan('callAI', async () => 'a');
    await withSpan('callAI', async () => 'b');
    await expect(
      withSpan('callAI', async () => {
        throw new Error('x');
      }),
    ).rejects.toThrow();
    const sum = summarizeTrace();
    expect(sum.total).toBe(3);
    expect(sum.errors).toBe(1);
    expect(sum.byName.callAI!.count).toBe(3);
    expect(sum.byName.callAI!.errors).toBe(1);
  });
});
