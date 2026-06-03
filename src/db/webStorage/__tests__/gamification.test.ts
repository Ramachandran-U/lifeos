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

function gam(over: Partial<WebGamification>): WebGamification {
  return {
    id: Math.random().toString(36).slice(2),
    userId: 'user-a',
    domainScores: '{}',
    streaks: '{}',
    badges: '[]',
    totalXP: 0,
    weeklyXP: 0,
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
