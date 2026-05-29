import { mapMessagesToGeminiContents, parseGeminiCandidate } from '../claude';

describe('mapMessagesToGeminiContents', () => {
  it('maps a plain string user message to a single text part', () => {
    expect(mapMessagesToGeminiContents([{ role: 'user', content: 'hello' }])).toEqual([
      { role: 'user', parts: [{ text: 'hello' }] },
    ]);
  });

  it('maps assistant role to model', () => {
    expect(mapMessagesToGeminiContents([{ role: 'assistant', content: 'hi' }])).toEqual([
      { role: 'model', parts: [{ text: 'hi' }] },
    ]);
  });

  it('passes through a functionCall part array verbatim (assistant turn)', () => {
    const parts = [{ functionCall: { name: 'getGoals', args: {} } }];
    expect(mapMessagesToGeminiContents([{ role: 'assistant', content: parts }])).toEqual([
      { role: 'model', parts },
    ]);
  });

  it('passes through a functionResponse part array verbatim (tool result turn)', () => {
    const parts = [{ functionResponse: { name: 'getGoals', response: { goals: [] } } }];
    expect(mapMessagesToGeminiContents([{ role: 'user', content: parts }])).toEqual([
      { role: 'user', parts },
    ]);
  });
});

describe('parseGeminiCandidate', () => {
  it('concatenates text parts', () => {
    const parsed = {
      candidates: [{ content: { parts: [{ text: 'Hello ' }, { text: 'world' }] } }],
    };
    expect(parseGeminiCandidate(parsed)).toEqual({ text: 'Hello world', functionCalls: [] });
  });

  it('extracts a functionCall with args', () => {
    const parsed = {
      candidates: [
        { content: { parts: [{ functionCall: { name: 'getRecentSleep', args: { days: 3 } } }] } },
      ],
    };
    expect(parseGeminiCandidate(parsed)).toEqual({
      text: '',
      functionCalls: [{ name: 'getRecentSleep', args: { days: 3 } }],
    });
  });

  it('defaults missing functionCall args to {}', () => {
    const parsed = {
      candidates: [{ content: { parts: [{ functionCall: { name: 'getGoals' } }] } }],
    };
    expect(parseGeminiCandidate(parsed).functionCalls).toEqual([{ name: 'getGoals', args: {} }]);
  });

  it('handles a mix of text and functionCall parts', () => {
    const parsed = {
      candidates: [
        {
          content: {
            parts: [
              { text: 'let me check' },
              { functionCall: { name: 'getStreaks', args: {} } },
            ],
          },
        },
      ],
    };
    const out = parseGeminiCandidate(parsed);
    expect(out.text).toBe('let me check');
    expect(out.functionCalls).toEqual([{ name: 'getStreaks', args: {} }]);
  });

  it('returns empty text + no calls for a malformed response', () => {
    expect(parseGeminiCandidate({})).toEqual({ text: '', functionCalls: [] });
    expect(parseGeminiCandidate({ candidates: [] })).toEqual({ text: '', functionCalls: [] });
  });
});
