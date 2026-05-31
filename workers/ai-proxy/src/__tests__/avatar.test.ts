import { extractImagePart, extractText } from '../avatar';

describe('extractImagePart', () => {
  it('reads a camelCase inlineData image part (REST response shape)', () => {
    const resp = {
      candidates: [
        { content: { parts: [{ inlineData: { data: 'AAAA', mimeType: 'image/png' } }] } },
      ],
    };
    expect(extractImagePart(resp)).toEqual({ data: 'AAAA', mimeType: 'image/png' });
  });

  it('falls back to snake_case inline_data', () => {
    const resp = {
      candidates: [
        { content: { parts: [{ inline_data: { data: 'BBBB', mime_type: 'image/jpeg' } }] } },
      ],
    };
    expect(extractImagePart(resp)).toEqual({ data: 'BBBB', mimeType: 'image/jpeg' });
  });

  it('skips text parts and finds the image part after them', () => {
    const resp = {
      candidates: [
        { content: { parts: [{ text: 'here you go' }, { inlineData: { data: 'CCCC' } }] } },
      ],
    };
    // mimeType defaults to image/png when the part omits it.
    expect(extractImagePart(resp)).toEqual({ data: 'CCCC', mimeType: 'image/png' });
  });

  it('returns null when there is no image part (text-only refusal)', () => {
    const resp = { candidates: [{ content: { parts: [{ text: 'I cannot do that' }] } }] };
    expect(extractImagePart(resp)).toBeNull();
  });

  it('returns null on a malformed / empty response', () => {
    expect(extractImagePart({})).toBeNull();
    expect(extractImagePart({ candidates: [] })).toBeNull();
  });
});

describe('extractText', () => {
  it('concatenates text parts (surfaces a refusal reason)', () => {
    const resp = {
      candidates: [{ content: { parts: [{ text: 'safety' }, { text: 'blocked' }] } }],
    };
    expect(extractText(resp)).toBe('safety blocked');
  });

  it('returns empty string when there are no text parts', () => {
    const resp = { candidates: [{ content: { parts: [{ inlineData: { data: 'x' } }] } }] };
    expect(extractText(resp)).toBe('');
  });
});
