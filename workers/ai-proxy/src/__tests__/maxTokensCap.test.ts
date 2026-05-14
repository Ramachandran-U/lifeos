import { resolveMaxTokensCap, resolveOutputTokens } from '../claude';

describe('resolveMaxTokensCap', () => {
  it('returns the default cap (4096) when env var is missing', () => {
    expect(resolveMaxTokensCap({ MAX_TOKENS_CAP: undefined })).toBe(4096);
  });

  it('returns the default cap when env var is empty string', () => {
    expect(resolveMaxTokensCap({ MAX_TOKENS_CAP: '' })).toBe(4096);
  });

  it('returns the default cap when env var is non-numeric', () => {
    expect(resolveMaxTokensCap({ MAX_TOKENS_CAP: 'eight-thousand' })).toBe(4096);
  });

  it('returns the default cap when env var is zero or negative', () => {
    expect(resolveMaxTokensCap({ MAX_TOKENS_CAP: '0' })).toBe(4096);
    expect(resolveMaxTokensCap({ MAX_TOKENS_CAP: '-100' })).toBe(4096);
  });

  it('honours a valid env cap inside the safe range', () => {
    expect(resolveMaxTokensCap({ MAX_TOKENS_CAP: '2500' })).toBe(2500);
    expect(resolveMaxTokensCap({ MAX_TOKENS_CAP: '6000' })).toBe(6000);
  });

  it('clamps up to the lower bound (1200) when env cap is too low', () => {
    expect(resolveMaxTokensCap({ MAX_TOKENS_CAP: '500' })).toBe(1200);
    expect(resolveMaxTokensCap({ MAX_TOKENS_CAP: '1' })).toBe(1200);
  });

  it('clamps down to the hard ceiling (8000) when env cap is too high', () => {
    expect(resolveMaxTokensCap({ MAX_TOKENS_CAP: '8001' })).toBe(8000);
    expect(resolveMaxTokensCap({ MAX_TOKENS_CAP: '50000' })).toBe(8000);
  });

  it('accepts the future 8000 ceiling exactly', () => {
    expect(resolveMaxTokensCap({ MAX_TOKENS_CAP: '8000' })).toBe(8000);
  });
});

describe('resolveOutputTokens', () => {
  const env4096 = { MAX_TOKENS_CAP: '4096' };

  it('uses the request value when below the env cap', () => {
    expect(resolveOutputTokens({ maxTokens: 2500 }, env4096)).toBe(2500);
  });

  it('caps the request value at the env cap', () => {
    expect(resolveOutputTokens({ maxTokens: 10000 }, env4096)).toBe(4096);
  });

  it('falls back to the request default (1200) when maxTokens is omitted', () => {
    expect(resolveOutputTokens({}, env4096)).toBe(1200);
  });

  it('respects a future 8000 env cap end-to-end', () => {
    expect(resolveOutputTokens({ maxTokens: 8000 }, { MAX_TOKENS_CAP: '8000' })).toBe(8000);
    expect(resolveOutputTokens({ maxTokens: 9999 }, { MAX_TOKENS_CAP: '8000' })).toBe(8000);
  });

  it('caps decomposeGoal-style 4000 request at default 4096 cap', () => {
    // Regression: this is the scenario that produced "Unbalanced JSON in AI response".
    // With the new default cap, a 4000-token request now passes through unchanged.
    expect(resolveOutputTokens({ maxTokens: 4000 }, env4096)).toBe(4000);
  });
});
