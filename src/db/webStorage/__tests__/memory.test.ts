/**
 * Web (localStorage) memory-fact storage: insert, user-scoped read, in-place
 * patch, delete, delete-all. In-memory localStorage shim for the node env.
 */
beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
});

import {
  webGetFactsByUser,
  webInsertFact,
  webUpdateFact,
  webDeleteFact,
  webDeleteAllFactsForUser,
  type WebMemoryFact,
} from '../memory';

function row(over: Partial<WebMemoryFact>): WebMemoryFact {
  return {
    id: Math.random().toString(36).slice(2),
    userId: 'u1',
    kind: 'pattern',
    text: 'Completes morning focus blocks',
    embedding: JSON.stringify([0.1, 0.2]),
    salience: 1,
    sourceWindow: '2026-05-01..2026-05-31',
    createdAt: '2026-05-31T00:00:00.000Z',
    lastSeenAt: '2026-05-31T00:00:00.000Z',
    expiresAt: null,
    ...over,
  };
}

it('inserts and reads back facts scoped to a user', () => {
  webInsertFact(row({ id: 'a', userId: 'u1' }));
  webInsertFact(row({ id: 'b', userId: 'u2' }));
  const mine = webGetFactsByUser('u1');
  expect(mine.map((f) => f.id)).toEqual(['a']);
});

it('patches a fact in place without touching its id', () => {
  webInsertFact(row({ id: 'fixed', salience: 1 }));
  webUpdateFact('fixed', { salience: 0.5, lastSeenAt: '2026-06-04T00:00:00.000Z' });
  const [f] = webGetFactsByUser('u1');
  expect(f.id).toBe('fixed');
  expect(f.salience).toBe(0.5);
  expect(f.lastSeenAt).toBe('2026-06-04T00:00:00.000Z');
});

it('webUpdateFact is a no-op for an unknown id', () => {
  webInsertFact(row({ id: 'a' }));
  webUpdateFact('missing', { salience: 0 });
  expect(webGetFactsByUser('u1')).toHaveLength(1);
});

it('deletes a single fact', () => {
  webInsertFact(row({ id: 'a' }));
  webInsertFact(row({ id: 'b' }));
  webDeleteFact('a');
  expect(webGetFactsByUser('u1').map((f) => f.id)).toEqual(['b']);
});

it('deletes all facts for one user only', () => {
  webInsertFact(row({ id: 'a', userId: 'u1' }));
  webInsertFact(row({ id: 'b', userId: 'u2' }));
  webDeleteAllFactsForUser('u1');
  expect(webGetFactsByUser('u1')).toHaveLength(0);
  expect(webGetFactsByUser('u2').map((f) => f.id)).toEqual(['b']);
});
