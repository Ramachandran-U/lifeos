import { mulberry32, hashSeed, rngFromKey, pickWeighted } from '@/utils/seededRandom';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces values in [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('different seeds diverge', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('hashSeed', () => {
  it('is deterministic and returns an unsigned 32-bit int', () => {
    const h = hashSeed('user123:2026-06-18');
    expect(h).toBe(hashSeed('user123:2026-06-18'));
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it('distinct inputs hash distinctly (spot check)', () => {
    const keys = ['a', 'b', 'user1:2026-06-18', 'user1:2026-06-19', 'user2:2026-06-18'];
    const hashes = new Set(keys.map(hashSeed));
    expect(hashes.size).toBe(keys.length);
  });
});

describe('rngFromKey', () => {
  it('same key → identical sequence (reproducible quests/loot)', () => {
    const seqA = Array.from({ length: 10 }, rngFromKey('quest:user1:2026-06-18'));
    const seqB = Array.from({ length: 10 }, rngFromKey('quest:user1:2026-06-18'));
    expect(seqA).toEqual(seqB);
  });
});

describe('pickWeighted', () => {
  it('returns 0 when all weights are zero (no crash)', () => {
    expect(pickWeighted(() => 0.99, [0, 0, 0])).toBe(0);
  });

  it('always picks the only non-zero bucket', () => {
    const r = mulberry32(99);
    for (let i = 0; i < 50; i++) expect(pickWeighted(r, [0, 1, 0])).toBe(1);
  });

  it('ignores negative weights (treated as zero)', () => {
    const r = mulberry32(3);
    for (let i = 0; i < 50; i++) expect(pickWeighted(r, [-5, 0, 2])).toBe(2);
  });

  it('over many rolls, an equal-weight set hits every bucket', () => {
    const r = rngFromKey('dist-test');
    const counts = [0, 0, 0];
    for (let i = 0; i < 300; i++) counts[pickWeighted(r, [1, 1, 1])]++;
    expect(counts.every((c) => c > 0)).toBe(true);
  });

  it('respects relative weights (heavier bucket wins more often)', () => {
    const r = rngFromKey('weighted');
    const counts = [0, 0];
    for (let i = 0; i < 1000; i++) counts[pickWeighted(r, [9, 1])]++;
    expect(counts[0]).toBeGreaterThan(counts[1]);
  });
});
