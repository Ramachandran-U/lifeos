import { computeCost, recordUsage, summarize, clearLedger, PRICING } from '../costLedger';

describe('costLedger', () => {
  beforeEach(() => clearLedger());

  test('computeCost: haiku, plain input/output', () => {
    const cost = computeCost('claude-haiku-4-5-20251001', { input_tokens: 1_000_000, output_tokens: 1_000_000 });
    expect(cost).toBeCloseTo(PRICING['claude-haiku-4-5-20251001']!.input + PRICING['claude-haiku-4-5-20251001']!.output, 5);
  });

  test('computeCost: sonnet with cache read 90% cheaper than fresh input', () => {
    const fresh = computeCost('claude-sonnet-4-6', { input_tokens: 1_000_000 });
    const cached = computeCost('claude-sonnet-4-6', { cache_read_input_tokens: 1_000_000 });
    expect(cached).toBeLessThan(fresh);
    expect(cached / fresh).toBeCloseTo(0.1, 2);
  });

  test('computeCost: cache write costs 1.25x input', () => {
    const fresh = computeCost('claude-sonnet-4-6', { input_tokens: 1_000_000 });
    const written = computeCost('claude-sonnet-4-6', { cache_creation_input_tokens: 1_000_000 });
    expect(written / fresh).toBeCloseTo(1.25, 2);
  });

  test('summarize: aggregates by task and model + cache hit rate', () => {
    recordUsage({
      model: 'claude-haiku-4-5-20251001',
      task: 'a',
      usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 900 },
    });
    recordUsage({
      model: 'claude-sonnet-4-6',
      task: 'b',
      usage: { input_tokens: 200, output_tokens: 100 },
    });
    const s = summarize();
    expect(s.calls).toBe(2);
    expect(s.totalInputTokens).toBe(300);
    expect(s.totalOutputTokens).toBe(150);
    expect(s.totalCacheReadTokens).toBe(900);
    // cache hit rate = 900 / (300 + 900) = 0.75
    expect(s.cacheHitRate).toBeCloseTo(0.75, 5);
    expect(s.byTask.a!.calls).toBe(1);
    expect(s.byTask.b!.calls).toBe(1);
    expect(s.byModel['claude-haiku-4-5-20251001']!.calls).toBe(1);
    expect(s.byModel['claude-sonnet-4-6']!.calls).toBe(1);
    expect(s.totalCostUsd).toBeGreaterThan(0);
  });

  test('recordUsage: null usage is a no-op', () => {
    recordUsage({ model: 'x', task: 'y', usage: null });
    expect(summarize().calls).toBe(0);
  });

  test('computeCost: gemini-2.5-flash uses Gemini rates, not Claude-haiku', () => {
    const cost = computeCost('gemini-2.5-flash', { input_tokens: 1_000_000, output_tokens: 1_000_000 });
    expect(cost).toBeCloseTo(0.3 + 2.5, 5);
    expect(cost).not.toBeCloseTo(1 + 5, 5);
  });

  test('computeCost: gemini cache read uses the cached-input rate', () => {
    const cached = computeCost('gemini-2.5-flash', { cache_read_input_tokens: 1_000_000 });
    expect(cached).toBeCloseTo(0.03, 5);
  });

  test('priceFor fallback: unknown gemini-* model prices as Gemini, not Claude', () => {
    const unknownGemini = computeCost('gemini-9-superflash', { input_tokens: 1_000_000 });
    expect(unknownGemini).toBeCloseTo(PRICING['gemini-2.5-flash']!.input, 5);
  });

  test('priceFor fallback: unknown claude-* model still prices as Claude-haiku', () => {
    const unknownClaude = computeCost('claude-future-9', { input_tokens: 1_000_000 });
    expect(unknownClaude).toBeCloseTo(PRICING['claude-haiku-4-5-20251001']!.input, 5);
  });
});
