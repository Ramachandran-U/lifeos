import {
  decayedSalience,
  isFactLive,
  findDuplicate,
  isSuppressed,
  rankFactsBySimilarity,
  formatSourceWindow,
  relativeSince,
  DEFAULT_HALF_LIFE_DAYS,
  MIN_EFFECTIVE_SALIENCE,
  type MemoryFact,
  type MemorySuppression,
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

describe('isSuppressed', () => {
  const sup = (over: Partial<MemorySuppression> = {}): MemorySuppression => ({
    id: 's1',
    userId: 'u1',
    text: 'forgotten',
    embedding: [1, 0],
    createdAt: '2026-05-30T00:00:00.000Z',
    ...over,
  });

  it('is true when an embedding matches a tombstone above threshold', () => {
    expect(isSuppressed([1, 0], [sup({ embedding: [1, 0] })])).toBe(true);
  });
  it('is false when nothing is similar enough', () => {
    expect(isSuppressed([1, 0], [sup({ embedding: [0, 1] })])).toBe(false);
  });
  it('ignores tombstones without an embedding, and an empty list', () => {
    expect(isSuppressed([1, 0], [sup({ embedding: null })])).toBe(false);
    expect(isSuppressed([1, 0], [])).toBe(false);
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

describe('formatSourceWindow', () => {
  it('renders a same-month window compactly', () => {
    expect(formatSourceWindow('2026-05-01..2026-05-31')).toBe('1–31 May 2026');
  });
  it('renders a cross-month window', () => {
    expect(formatSourceWindow('2026-04-28..2026-05-30')).toBe('28 Apr – 30 May 2026');
  });
  it('renders a cross-year window', () => {
    expect(formatSourceWindow('2025-12-20..2026-01-10')).toBe('20 Dec 2025 – 10 Jan 2026');
  });
  it('returns null for no window or a malformed one', () => {
    expect(formatSourceWindow(null)).toBeNull();
    expect(formatSourceWindow('last month')).toBeNull();
  });
});

describe('relativeSince', () => {
  it('labels recent times', () => {
    expect(relativeSince(new Date(NOW).toISOString(), NOW)).toBe('today');
    expect(relativeSince(new Date(NOW - 86_400_000).toISOString(), NOW)).toBe('yesterday');
    expect(relativeSince(new Date(NOW - 3 * 86_400_000).toISOString(), NOW)).toBe('3 days ago');
  });
  it('labels weeks and months', () => {
    expect(relativeSince(new Date(NOW - 20 * 86_400_000).toISOString(), NOW)).toBe('2 weeks ago');
    expect(relativeSince(new Date(NOW - 60 * 86_400_000).toISOString(), NOW)).toBe('2 months ago');
  });
});
