/**
 * webStorage/chests — insert/update/read shapes, the pending-never-pruned
 * retention rule, and the per-day count that backs the ≤1/day grant cap.
 */

beforeAll(() => {
  const store: Record<string, string> = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
});

import { subDays, format } from 'date-fns';
import {
  webInsertChest,
  webUpdateChest,
  webGetChestById,
  webGetPendingChests,
  webCountChestsGrantedOnDay,
  type WebChest,
} from '../chests';

const TODAY = format(new Date(), 'yyyy-MM-dd');

function chest(over: Partial<WebChest>): WebChest {
  const id = over.id ?? Math.random().toString(36).slice(2);
  return {
    id,
    userId: 'user-a',
    source: 'peak_beat',
    status: 'pending',
    seed: `chest:user-a:${TODAY}:${id}`,
    contents: null,
    dayLocal: TODAY,
    grantedAt: new Date().toISOString(),
    claimedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    ...over,
  };
}

beforeEach(() => {
  (globalThis as { localStorage: { clear: () => void } }).localStorage.clear();
});

describe('webStorage/chests', () => {
  test('insert + fetch by id round-trips the row', () => {
    const row = chest({ id: 'c1' });
    webInsertChest(row);
    expect(webGetChestById('c1')).toEqual(row);
  });

  test('pending list is user-scoped and excludes opened/deleted rows', () => {
    webInsertChest(chest({ id: 'mine-pending' }));
    webInsertChest(chest({ id: 'mine-opened', status: 'opened' }));
    webInsertChest(chest({ id: 'mine-deleted', deletedAt: new Date().toISOString() }));
    webInsertChest(chest({ id: 'theirs', userId: 'user-b' }));
    expect(webGetPendingChests('user-a').map((ch) => ch.id)).toEqual(['mine-pending']);
  });

  test('update seals contents + status without touching identity fields', () => {
    webInsertChest(chest({ id: 'c2' }));
    webUpdateChest('c2', {
      status: 'opened',
      contents: JSON.stringify({ type: 'xp', amount: 50 }),
      claimedAt: new Date().toISOString(),
    });
    const updated = webGetChestById('c2')!;
    expect(updated.status).toBe('opened');
    expect(JSON.parse(updated.contents!)).toEqual({ type: 'xp', amount: 50 });
    expect(updated.userId).toBe('user-a');
  });

  test('per-day count includes every grant that day regardless of status', () => {
    webInsertChest(chest({ id: 'today-1' }));
    webInsertChest(chest({ id: 'today-2', status: 'opened' }));
    webInsertChest(chest({ id: 'old', dayLocal: format(subDays(new Date(), 3), 'yyyy-MM-dd') }));
    expect(webCountChestsGrantedOnDay('user-a', TODAY)).toBe(2);
  });

  test('prune drops OPENED rows past retention but NEVER a pending chest (no expiry)', () => {
    const ancient = format(subDays(new Date(), 200), 'yyyy-MM-dd');
    webInsertChest(chest({ id: 'old-opened', status: 'opened', dayLocal: ancient }));
    webInsertChest(chest({ id: 'old-pending', dayLocal: ancient }));
    // Prune runs on the next insert.
    webInsertChest(chest({ id: 'fresh' }));
    expect(webGetChestById('old-opened')).toBeUndefined();
    expect(webGetChestById('old-pending')).toBeDefined();
  });
});
