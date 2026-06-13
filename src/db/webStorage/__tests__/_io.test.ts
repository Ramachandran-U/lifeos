/**
 * webStorage/_io — the shared localStorage read/write helpers. Guards defect D6:
 * a quota-exceeded write must surface as a typed, catchable StorageQuotaError
 * (not an opaque DOMException that crashes the action / wedges later writes).
 */
let store: Record<string, string>;
let throwOnSet: unknown = null;

beforeEach(() => {
  store = {};
  throwOnSet = null;
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      if (throwOnSet) throw throwOnSet;
      store[k] = v;
    },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
});

import { load, save, StorageQuotaError } from '../_io';

class FakeQuotaError extends Error {
  code = 22;
  constructor() {
    super('quota');
    this.name = 'QuotaExceededError';
  }
}

describe('_io load/save', () => {
  it('round-trips records', () => {
    save('lifeos_test', [{ a: 1 }, { a: 2 }]);
    expect(load<{ a: number }>('lifeos_test')).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('load returns [] for a missing or corrupt key', () => {
    expect(load('nope')).toEqual([]);
    store['lifeos_bad'] = '{not json';
    expect(load('lifeos_bad')).toEqual([]);
  });

  it('throws a typed StorageQuotaError when the write exceeds quota', () => {
    throwOnSet = new FakeQuotaError();
    expect(() => save('lifeos_users', [{ big: 'x' }])).toThrow(StorageQuotaError);
    try {
      save('lifeos_users', [{ big: 'x' }]);
    } catch (e) {
      expect(e).toBeInstanceOf(StorageQuotaError);
      expect((e as StorageQuotaError).key).toBe('lifeos_users');
    }
  });

  it('re-throws non-quota errors unchanged', () => {
    const boom = new Error('disk on fire');
    throwOnSet = boom;
    expect(() => save('lifeos_users', [{}])).toThrow(boom);
  });
});
