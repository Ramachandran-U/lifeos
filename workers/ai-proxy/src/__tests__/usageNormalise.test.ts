import { normaliseUsage, toCanonicalUsage } from '../claude';

describe('normaliseUsage', () => {
  it('maps Anthropic usage fields', () => {
    expect(
      normaliseUsage('anthropic', {
        input_tokens: 10,
        output_tokens: 20,
        cache_read_input_tokens: 5,
        cache_creation_input_tokens: 3,
      }),
    ).toEqual({ input: 10, output: 20, cacheRead: 5, cacheCreation: 3 });
  });

  it('maps Gemini usageMetadata fields', () => {
    expect(
      normaliseUsage('gemini', {
        promptTokenCount: 100,
        candidatesTokenCount: 40,
        cachedContentTokenCount: 25,
      }),
    ).toEqual({ input: 100, output: 40, cacheRead: 25, cacheCreation: 0 });
  });

  it('maps OpenAI/Groq usage fields', () => {
    expect(
      normaliseUsage('openai', { prompt_tokens: 7, completion_tokens: 9 }),
    ).toEqual({ input: 7, output: 9, cacheRead: 0, cacheCreation: 0 });
  });

  it('defaults unknown/missing fields to 0 (no schema-drift poisoning)', () => {
    expect(normaliseUsage('gemini', null)).toEqual({ input: 0, output: 0, cacheRead: 0, cacheCreation: 0 });
    expect(normaliseUsage('gemini', { promptTokenCount: 'nan' })).toEqual({
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheCreation: 0,
    });
  });
});

describe('toCanonicalUsage', () => {
  it('renames Gemini usage to canonical Anthropic-style keys for the client', () => {
    expect(
      toCanonicalUsage('gemini', {
        promptTokenCount: 100,
        candidatesTokenCount: 40,
        cachedContentTokenCount: 25,
      }),
    ).toEqual({
      input_tokens: 100,
      output_tokens: 40,
      cache_read_input_tokens: 25,
      cache_creation_input_tokens: 0,
    });
  });

  it('passes Anthropic usage through under the same canonical keys', () => {
    expect(
      toCanonicalUsage('anthropic', { input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3 }),
    ).toEqual({
      input_tokens: 1,
      output_tokens: 2,
      cache_read_input_tokens: 3,
      cache_creation_input_tokens: 0,
    });
  });
});
