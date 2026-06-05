/**
 * Web read SYNC CONTRACT guard.
 *
 * The per-entity web stores (users, goals, health, gamification, contacts, …)
 * are a SYNCHRONOUS localStorage shim (src/db/webStorage/_io.ts —
 * `JSON.parse(localStorage.getItem(...))`). So query-layer reads like getUser()
 * / getGoalsByUser() return a VALUE, never a Promise, and the render + voice/
 * agent paths rely on that synchrony. Only the FINANCE store is Dexie/IndexedDB
 * (async); it is deliberately not exercised here.
 *
 * If a per-entity store is ever migrated to Dexie (async), these reads would
 * start returning Promises and silently break synchronous callers. This test
 * fails loudly the moment that happens — turning a latent runtime footgun into a
 * red CI gate. (This is the durable fix for the "could getUser() return a
 * Promise on web?" review thread: today it cannot, and this keeps it that way.)
 */

// Force the web branch in every queries file (they read `Platform.OS === 'web'`).
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('@/sync/runtime', () => ({ recordMutation: jest.fn() }));

beforeAll(() => {
  const store: Record<string, string> = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
});

import { getUser } from '../users';
import { getGoalsByUser } from '../goals';

const isThenable = (v: unknown): boolean =>
  v != null && (typeof v === 'object' || typeof v === 'function') &&
  typeof (v as { then?: unknown }).then === 'function';

describe('web read sync contract — per-entity stores must stay synchronous', () => {
  it('getUser() returns synchronously, never a Promise', () => {
    const r = getUser();
    expect(isThenable(r)).toBe(false);
  });

  it('getGoalsByUser() returns an array synchronously, never a Promise', () => {
    const r = getGoalsByUser('nobody');
    expect(isThenable(r)).toBe(false);
    expect(Array.isArray(r)).toBe(true);
  });
});
