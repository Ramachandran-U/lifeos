import { buildMockYouTubeImport } from '../mocks/polymath';
import { YouTubeImportSchema } from '../types';

describe('buildMockYouTubeImport', () => {
  it('returns interests that validate against the schema', () => {
    const out = buildMockYouTubeImport({
      channels: [{ title: 'Babish', description: 'cooking' }],
      existingInterests: [],
    });
    expect(() => YouTubeImportSchema.parse(out)).not.toThrow();
    expect(out.interests.length).toBeGreaterThan(0);
  });

  it('drops candidates that duplicate an existing interest (case-insensitive)', () => {
    const out = buildMockYouTubeImport({
      channels: [],
      existingInterests: ['HOME COOKING', 'music production'],
    });
    const names = out.interests.map((i) => i.name.toLowerCase());
    expect(names).not.toContain('home cooking');
    expect(names).not.toContain('music production');
  });
});

describe('YouTubeImportSchema', () => {
  it('rejects an out-of-set category', () => {
    expect(() =>
      YouTubeImportSchema.parse({
        interests: [{ name: 'X', category: 'cooking', weeklyMinutesTarget: 60, why: 'y' }],
      }),
    ).toThrow();
  });

  it('rejects a non-integer / out-of-range weekly target', () => {
    expect(() =>
      YouTubeImportSchema.parse({
        interests: [{ name: 'X', category: 'science', weeklyMinutesTarget: 9000, why: 'y' }],
      }),
    ).toThrow();
  });

  it('accepts a well-formed import', () => {
    const parsed = YouTubeImportSchema.parse({
      interests: [{ name: 'Astrophysics', category: 'science', weeklyMinutesTarget: 45, why: 'from space channels' }],
    });
    expect(parsed.interests[0].name).toBe('Astrophysics');
  });
});
