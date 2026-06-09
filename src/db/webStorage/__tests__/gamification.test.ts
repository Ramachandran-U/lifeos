/**
 * webStorage/gamification — user-scoped fetch, upsert idempotency, partial
 * update, and the rolling N-day behaviour-event cutoff.
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
  webGetGamification,
  webUpsertGamification,
  webUpdateGamification,
  webInsertBehaviourEvent,
  webGetBehaviourEventsLastNDays,
  type WebGamification,
  type WebBehaviourEvent,
} from '../gamification';
import { BEHAVIOUR_WEB_CAP, BEHAVIOUR_RETENTION_DAYS } from '../../retention';
import { BEHAVIOUR_KEY } from '../_keys';

function gam(over: Partial<WebGamification>): WebGamification {
  return {
    id: Math.random().toString(36).slice(2),
    userId: 'user-a',
    domainScores: '{}',
    streaks: '{}',
    badges: '[]',
    totalXP: 0,
    weeklyXP: 0,
    streakFreezes: 0,
    freezeProgressXP: 0,
    cosmetics: '[]',
    companion: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function event(over: Partial<WebBehaviourEvent>): WebBehaviourEvent {
  return {
    id: Math.random().toString(36).slice(2),
    eventType: 'logged',
    module: 'health',
    metadata: null,
    hour: 9,
    dayOfWeek: 1,
    createdAt: format(new Date(), 'yyyy-MM-dd'),
    ...over,
  };
}

beforeEach(() => { localStorage.clear(); });

describe('gamification record', () => {
  it('upserts by userId idempotently and reads back the latest', () => {
    webUpsertGamification(gam({ userId: 'user-a', totalXP: 10 }));
    webUpsertGamification(gam({ userId: 'user-a', totalXP: 50 }));
    expect(webGetGamification('user-a')?.totalXP).toBe(50);
    // user-scoped: another user has no record yet
    expect(webGetGamification('user-b')).toBeUndefined();
  });

  it('partial-updates and bumps updatedAt; no-op for unknown user', () => {
    webUpsertGamification(gam({ userId: 'user-a', weeklyXP: 0, updatedAt: '2026-01-01T00:00:00.000Z' }));
    webUpdateGamification('user-a', { weeklyXP: 200 });
    const after = webGetGamification('user-a');
    expect(after?.weeklyXP).toBe(200);
    expect(after?.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');

    webUpdateGamification('missing', { weeklyXP: 999 });
    expect(webGetGamification('user-a')?.weeklyXP).toBe(200);
  });
});

describe('webGetBehaviourEventsLastNDays', () => {
  it('keeps only events at or after the N-day cutoff', () => {
    const recent = format(subDays(new Date(), 2), 'yyyy-MM-dd');
    const old = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    webInsertBehaviourEvent(event({ id: 'e1', createdAt: recent }));
    webInsertBehaviourEvent(event({ id: 'e2', createdAt: old }));
    expect(webGetBehaviourEventsLastNDays(7).map((e) => e.id)).toEqual(['e1']);
  });
});

describe('webInsertBehaviourEvent — bounded growth', () => {
  const today = () => format(new Date(), 'yyyy-MM-dd');
  const raw = (): WebBehaviourEvent[] =>
    JSON.parse(localStorage.getItem(BEHAVIOUR_KEY) ?? '[]') as WebBehaviourEvent[];

  it('prunes past-retention events at write time, so stale rows never accumulate', () => {
    const stale = format(subDays(new Date(), BEHAVIOUR_RETENTION_DAYS + 5), 'yyyy-MM-dd');
    // An aged event already sitting in storage (the read filter alone would
    // hide it but leave it on disk forever).
    localStorage.setItem(BEHAVIOUR_KEY, JSON.stringify([event({ id: 'stale', createdAt: stale })]));
    webInsertBehaviourEvent(event({ id: 'fresh', createdAt: today() }));
    // It is physically gone, not merely filtered on read.
    expect(raw().map((e) => e.id)).toEqual(['fresh']);
  });

  it('keeps an event exactly on the retention boundary', () => {
    const boundary = format(subDays(new Date(), BEHAVIOUR_RETENTION_DAYS), 'yyyy-MM-dd');
    webInsertBehaviourEvent(event({ id: 'edge', createdAt: boundary }));
    expect(raw().map((e) => e.id)).toEqual(['edge']);
  });

  it('enforces a hard count cap, dropping the oldest and keeping the newest', () => {
    // Seed exactly the cap with in-window events, then insert one more.
    const seed: WebBehaviourEvent[] = Array.from({ length: BEHAVIOUR_WEB_CAP }, (_, i) =>
      event({ id: `seed-${i}`, createdAt: today() }),
    );
    localStorage.setItem(BEHAVIOUR_KEY, JSON.stringify(seed));
    webInsertBehaviourEvent(event({ id: 'newest', createdAt: today() }));
    const stored = raw();
    expect(stored).toHaveLength(BEHAVIOUR_WEB_CAP);
    expect(stored[stored.length - 1].id).toBe('newest'); // newest retained
    expect(stored.some((e) => e.id === 'seed-0')).toBe(false); // oldest evicted
    expect(stored.some((e) => e.id === 'seed-1')).toBe(true);
  });

  it('recovers from a localStorage quota error by retrying with a trimmed tail', () => {
    const seed: WebBehaviourEvent[] = Array.from({ length: 200 }, (_, i) =>
      event({ id: `s-${i}`, createdAt: today() }),
    );
    localStorage.setItem(BEHAVIOUR_KEY, JSON.stringify(seed));
    const realSet = localStorage.setItem.bind(localStorage);
    let calls = 0;
    localStorage.setItem = (k: string, v: string) => {
      calls += 1;
      if (calls === 1) throw new Error('QuotaExceededError'); // first (full) write fails
      realSet(k, v);
    };
    expect(() =>
      webInsertBehaviourEvent(event({ id: 'after-quota', createdAt: today() })),
    ).not.toThrow();
    localStorage.setItem = realSet;
    // The retry persisted a trimmed tail that still includes the newest event.
    const stored = raw();
    expect(stored.length).toBeLessThanOrEqual(Math.floor(BEHAVIOUR_WEB_CAP / 5));
    expect(stored[stored.length - 1].id).toBe('after-quota');
  });

  it('never throws even when every write fails (analytics must not break the UI)', () => {
    const realSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(() => webInsertBehaviourEvent(event({ id: 'x', createdAt: today() }))).not.toThrow();
    localStorage.setItem = realSet;
  });
});
