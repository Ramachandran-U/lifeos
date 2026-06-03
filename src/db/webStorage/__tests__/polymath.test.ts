/**
 * webStorage/polymath — interest user-scoping + 'deleted'-status exclusion,
 * update, echo-safe upsert-by-id paths (interest + exploration log) used by
 * the sync reducer, and the interest→exploration join.
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

import {
  webInsertInterest,
  webGetInterestsByUser,
  webUpdateInterest,
  webSoftDeleteInterest,
  webUpsertInterestById,
  webInsertExploration,
  webUpsertExplorationById,
  webGetExplorationByInterest,
  webGetExplorationForUser,
  type WebInterest,
  type WebExplorationLog,
} from '../polymath';

function interest(over: Partial<WebInterest>): WebInterest {
  return {
    id: Math.random().toString(36).slice(2),
    userId: 'user-a',
    name: 'Astronomy',
    category: 'science',
    weeklyMinutesTarget: 60,
    weeklyMinutesActual: 0,
    explorationDepth: 'casual',
    status: 'active',
    discoveredBy: 'user',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function exploration(over: Partial<WebExplorationLog>): WebExplorationLog {
  return {
    id: Math.random().toString(36).slice(2),
    interestId: 'i1',
    date: '2026-05-01',
    minutesSpent: 30,
    createdAt: '2026-05-01T00:00:00.000Z',
    ...over,
  };
}

beforeEach(() => { localStorage.clear(); });

describe('interests', () => {
  it('scopes by user and excludes the deleted status', () => {
    webInsertInterest(interest({ id: 'i1', userId: 'user-a' }));
    webInsertInterest(interest({ id: 'i2', userId: 'user-b' }));
    webInsertInterest(interest({ id: 'i3', userId: 'user-a' }));
    webSoftDeleteInterest('i3');
    expect(webGetInterestsByUser('user-a').map((i) => i.id)).toEqual(['i1']);
  });

  it('updates a field and bumps updatedAt', () => {
    webInsertInterest(interest({ id: 'i1', weeklyMinutesActual: 0, updatedAt: '2026-01-01T00:00:00.000Z' }));
    webUpdateInterest('i1', { weeklyMinutesActual: 45 });
    const [row] = webGetInterestsByUser('user-a');
    expect(row.weeklyMinutesActual).toBe(45);
    expect(row.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
  });

  it('upserts an interest by id idempotently (echo-safe sync path)', () => {
    const row = interest({ id: 'i1', name: 'first', updatedAt: '2026-03-01T00:00:00.000Z' });
    webUpsertInterestById(row);
    webUpsertInterestById(interest({ id: 'i1', name: 'second', updatedAt: '2026-03-01T00:00:00.000Z' }));
    webUpsertInterestById(interest({ id: 'i1', name: 'second', updatedAt: '2026-03-01T00:00:00.000Z' }));
    const all = webGetInterestsByUser('user-a');
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('second');
    expect(all[0].updatedAt).toBe('2026-03-01T00:00:00.000Z'); // not rewritten
  });
});

describe('exploration logs', () => {
  it('filters by interest and upserts by id idempotently', () => {
    webUpsertExplorationById(exploration({ id: 'e1', interestId: 'i1', minutesSpent: 30 }));
    webUpsertExplorationById(exploration({ id: 'e1', interestId: 'i1', minutesSpent: 90 }));
    webInsertExploration(exploration({ id: 'e2', interestId: 'i2' }));
    const forI1 = webGetExplorationByInterest('i1');
    expect(forI1).toHaveLength(1);
    expect(forI1[0].minutesSpent).toBe(90);
  });

  it('joins exploration logs to a set of users through their interests', () => {
    webInsertInterest(interest({ id: 'i1', userId: 'user-a' }));
    webInsertInterest(interest({ id: 'i2', userId: 'user-b' }));
    webInsertExploration(exploration({ id: 'e1', interestId: 'i1' }));
    webInsertExploration(exploration({ id: 'e2', interestId: 'i2' }));
    expect(webGetExplorationForUser(['user-a']).map((e) => e.id)).toEqual(['e1']);
    expect(webGetExplorationForUser(['user-a', 'user-b']).map((e) => e.id).sort()).toEqual(['e1', 'e2']);
  });
});
