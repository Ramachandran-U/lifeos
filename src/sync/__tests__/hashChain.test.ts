import { canonicalize, chainHash, validateChain } from '../hashChain';
import { testHasher } from './testHasher';

describe('canonicalize', () => {
  it('is key-order independent for objects', () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }));
  });

  it('preserves array order (order is semantic)', () => {
    expect(canonicalize([1, 2, 3])).not.toBe(canonicalize([3, 2, 1]));
  });

  it('sorts nested keys recursively', () => {
    const x = { outer: { z: 1, a: 2 }, list: [{ b: 1, a: 2 }] };
    const y = { list: [{ a: 2, b: 1 }], outer: { a: 2, z: 1 } };
    expect(canonicalize(x)).toBe(canonicalize(y));
  });

  it('drops undefined values', () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe(canonicalize({ a: 1 }));
  });
});

describe('chainHash', () => {
  it('is deterministic for the same prev + payload', async () => {
    const h1 = await chainHash('prev', { a: 1 }, testHasher);
    const h2 = await chainHash('prev', { a: 1 }, testHasher);
    expect(h1).toBe(h2);
  });

  it('changes when the payload changes', async () => {
    const h1 = await chainHash('prev', { a: 1 }, testHasher);
    const h2 = await chainHash('prev', { a: 2 }, testHasher);
    expect(h1).not.toBe(h2);
  });

  it('changes when the previous head changes (chaining)', async () => {
    const h1 = await chainHash('prevA', { a: 1 }, testHasher);
    const h2 = await chainHash('prevB', { a: 1 }, testHasher);
    expect(h1).not.toBe(h2);
  });

  it('treats null prev as empty string', async () => {
    const a = await chainHash(null, { a: 1 }, testHasher);
    const b = await chainHash('', { a: 1 }, testHasher);
    expect(a).toBe(b);
  });
});

describe('validateChain', () => {
  async function buildChain(payloads: unknown[]) {
    const entries: Array<{ prevHash: string | null; hash: string; payload: unknown }> = [];
    let prev: string | null = null;
    for (const p of payloads) {
      const hash = await chainHash(prev, p, testHasher);
      entries.push({ prevHash: prev, hash, payload: p });
      prev = hash;
    }
    return entries;
  }

  it('returns -1 for an intact chain', async () => {
    const chain = await buildChain([{ a: 1 }, { b: 2 }, { c: 3 }]);
    expect(await validateChain(chain, testHasher)).toBe(-1);
  });

  it('detects a tampered payload', async () => {
    const chain = await buildChain([{ a: 1 }, { b: 2 }, { c: 3 }]);
    chain[1] = { ...chain[1]!, payload: { b: 999 } }; // tamper content, keep stored hash
    expect(await validateChain(chain, testHasher)).toBe(1);
  });

  it('detects a broken prevHash link', async () => {
    const chain = await buildChain([{ a: 1 }, { b: 2 }]);
    chain[1] = { ...chain[1]!, prevHash: 'wrong' };
    expect(await validateChain(chain, testHasher)).toBe(1);
  });
});
