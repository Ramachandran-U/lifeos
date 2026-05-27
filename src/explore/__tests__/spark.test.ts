import {
  isConcreteSpark,
  isFreshSpark,
  pickSparkSeeds,
  buildMockSpark,
  generateDailySpark,
  type GeneratedSpark,
  type DailySparkInput,
} from '../spark';

function spark(over: Partial<GeneratedSpark> = {}): GeneratedSpark {
  return {
    title: 'The hidden grammar of chess',
    body: 'Skilled players follow a structure they could never articulate — a grammar learned by feel. Naming it explicitly is what lets you teach it.',
    threadStarter: 'What is the first unspoken rule you would write down?',
    seedInterest: 'chess',
    adjacentField: 'linguistics',
    ...over,
  };
}

const interests = [
  { name: 'chess', category: 'other' },
  { name: 'cooking', category: 'other' },
  { name: 'jazz', category: 'music' },
];

describe('isConcreteSpark', () => {
  it('accepts a substantive spark with a question thread-starter', () => {
    expect(isConcreteSpark(spark())).toBe(true);
  });
  it('rejects too-short bodies', () => {
    expect(isConcreteSpark(spark({ body: 'Too short.' }))).toBe(false);
  });
  it('rejects a thread-starter that is not a question', () => {
    expect(isConcreteSpark(spark({ threadStarter: 'Go think about it.' }))).toBe(false);
  });
  it('rejects filler/cliche content', () => {
    expect(isConcreteSpark(spark({ body: 'Remember that everything is connected and the possibilities are endless when you explore.' }))).toBe(false);
    expect(isConcreteSpark(spark({ title: 'Did you know?' }))).toBe(false);
  });
});

describe('isFreshSpark', () => {
  it('detects recently-shown titles case/space-insensitively', () => {
    expect(isFreshSpark('The Hidden  Grammar of Chess', ['the hidden grammar of chess'])).toBe(false);
    expect(isFreshSpark('A new spark', ['something else'])).toBe(true);
  });
});

describe('pickSparkSeeds', () => {
  it('returns all when <= 2 interests', () => {
    expect(pickSparkSeeds(interests.slice(0, 2), 0)).toHaveLength(2);
    expect(pickSparkSeeds([], 0)).toEqual([]);
  });
  it('rotates the pair by day so sparks vary', () => {
    const d0 = pickSparkSeeds(interests, 0).map((i) => i.name);
    const d1 = pickSparkSeeds(interests, 1).map((i) => i.name);
    expect(d0).toEqual(['chess', 'cooking']);
    expect(d1).toEqual(['cooking', 'jazz']);
  });
});

describe('buildMockSpark', () => {
  it('produces a concrete spark grounded in a seed interest', () => {
    const s = buildMockSpark({ interests, recentSparkTitles: [] }, 0);
    expect(isConcreteSpark(s)).toBe(true);
    expect(s.seedInterest).toBe('chess');
  });
  it('handles a user with no interests gracefully', () => {
    const s = buildMockSpark({ interests: [], recentSparkTitles: [] }, 0);
    expect(isConcreteSpark(s)).toBe(true);
  });
});

describe('generateDailySpark (mock mode)', () => {
  const prev = process.env.USE_AI_MOCK;
  beforeAll(() => { process.env.USE_AI_MOCK = 'true'; });
  afterAll(() => { process.env.USE_AI_MOCK = prev; });

  it('returns a concrete spark without hitting the network', async () => {
    const input: DailySparkInput = { interests, recentSparkTitles: [] };
    const s = await generateDailySpark(input, 0);
    expect(isConcreteSpark(s)).toBe(true);
  });
});
