import {
  decayedSalience,
  isFactLive,
  findDuplicate,
  rankFactsBySimilarity,
  DEFAULT_HALF_LIFE_DAYS,
  MIN_EFFECTIVE_SALIENCE,
  type MemoryFact,
} from '../rag/memoryStore';

const NOW = Date.parse('2026-05-30T00:00:00Z');

function fact(over: Partial<MemoryFact> = {}): MemoryFact {
  return {
    id: 'f1',
    userId: 'u1',
    kind: 'preference',
    text: 'fact',
    salience: 1,
    sourceWindow: null,
    createdAt: '2026-05-30T00:00:00.000Z',
    lastSeenAt: '2026-05-30T00:00:00.000Z',
    expiresAt: null,
    embedding: [1, 0],
    ...over,
  };
}

describe('decayedSalience', () => {
  it('halves after one half-life', () => {
    const lastSeen = new Date(NOW - DEFAULT_HALF_LIFE_DAYS * 86_400_000).toISOString();
    expect(decayedSalience(1, lastSeen, NOW)).toBeCloseTo(0.5, 5);
  });

  it('is unchanged when just seen', () => {
    expect(decayedSalience(1, new Date(NOW).toISOString(), NOW)).toBe(1);
  });
});

describe('isFactLive', () => {
  it('is false past a hard expiry', () => {
    expect(isFactLive(fact({ expiresAt: '2026-05-29T00:00:00.000Z' }), NOW)).toBe(false);
  });

  it('is false once decayed below the salience floor', () => {
    // 10 half-lives ⇒ salience ≈ 0.001, well below the floor
    const old = new Date(NOW - 10 * DEFAULT_HALF_LIFE_DAYS * 86_400_000).toISOString();
    expect(isFactLive(fact({ salience: 1, lastSeenAt: old }), NOW)).toBe(false);
  });

  it('is true for a fresh, salient fact', () => {
    expect(isFactLive(fact(), NOW)).toBe(true);
  });
});

describe('findDuplicate', () => {
  it('returns the most-similar existing fact above the threshold', () => {
    const existing = [fact({ id: 'a', embedding: [1, 0] }), fact({ id: 'b', embedding: [0, 1] })];
    expect(findDuplicate([1, 0], existing)?.id).toBe('a');
  });

  it('returns null when nothing is similar enough', () => {
    const existing = [fact({ id: 'a', embedding: [0, 1] })];
    expect(findDuplicate([1, 0], existing)).toBeNull();
  });

  it('ignores facts without an embedding', () => {
    const existing = [fact({ id: 'a', embedding: null })];
    expect(findDuplicate([1, 0], existing)).toBeNull();
  });
});

describe('rankFactsBySimilarity', () => {
  it('orders by similarity to the query and drops dead facts', () => {
    const dead = new Date(NOW - 10 * DEFAULT_HALF_LIFE_DAYS * 86_400_000).toISOString();
    const facts = [
      fact({ id: 'match', embedding: [1, 0] }),
      fact({ id: 'orthogonal', embedding: [0, 1] }),
      fact({ id: 'decayed', embedding: [1, 0], lastSeenAt: dead }),
    ];
    const ranked = rankFactsBySimilarity([1, 0], facts, 5, NOW);
    expect(ranked.map((f) => f.id)).toEqual(['match', 'orthogonal']);
  });

  it('respects k', () => {
    const facts = [
      fact({ id: 'a', embedding: [1, 0] }),
      fact({ id: 'b', embedding: [0.8, 0.2] }),
      fact({ id: 'c', embedding: [0.6, 0.4] }),
    ];
    expect(rankFactsBySimilarity([1, 0], facts, 2, NOW)).toHaveLength(2);
  });
});
