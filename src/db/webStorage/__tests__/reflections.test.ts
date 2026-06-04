/**
 * webStorage/reflections — upsert-by-date (one row per day), the echo-safe
 * upsert-by-id sync path, by-date fetch, and the rolling N-day window sorted
 * ascending.
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
  webUpsertReflection,
  webUpsertReflectionById,
  webGetReflectionByDate,
  webGetRecentReflections,
  type WebDailyReflection,
} from '../reflections';

function reflection(over: Partial<WebDailyReflection>): WebDailyReflection {
  return {
    id: Math.random().toString(36).slice(2),
    date: '2026-05-01',
    mood: 4,
    blockReviews: '[]',
    tweakAccepted: null,
    tweakPayload: null,
    notes: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    ...over,
  };
}

beforeEach(() => { localStorage.clear(); });

describe('webUpsertReflection (by date)', () => {
  it('keeps a single row per date, replacing on the second upsert', () => {
    webUpsertReflection(reflection({ id: 'r1', date: '2026-05-01', mood: 3 }));
    webUpsertReflection(reflection({ id: 'r2', date: '2026-05-01', mood: 5 }));
    const found = webGetReflectionByDate('2026-05-01');
    expect(found?.mood).toBe(5);
    expect(webGetRecentReflections(3650)).toHaveLength(1);
  });
});

describe('webUpsertReflectionById (echo-safe sync path)', () => {
  it('inserts then replaces in place by id idempotently', () => {
    webUpsertReflectionById(reflection({ id: 'r1', date: '2026-05-01', mood: 3 }));
    webUpsertReflectionById(reflection({ id: 'r1', date: '2026-05-01', mood: 4 }));
    webUpsertReflectionById(reflection({ id: 'r1', date: '2026-05-01', mood: 4 }));
    expect(webGetRecentReflections(3650)).toHaveLength(1);
    expect(webGetReflectionByDate('2026-05-01')?.mood).toBe(4);
  });
});

describe('webGetRecentReflections', () => {
  it('keeps only dates at/after the cutoff, sorted ascending', () => {
    const recentA = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const recentB = format(subDays(new Date(), 3), 'yyyy-MM-dd');
    const old = format(subDays(new Date(), 60), 'yyyy-MM-dd');
    webUpsertReflectionById(reflection({ id: 'a', date: recentA }));
    webUpsertReflectionById(reflection({ id: 'b', date: recentB }));
    webUpsertReflectionById(reflection({ id: 'c', date: old }));
    const out = webGetRecentReflections(7).map((r) => r.date);
    expect(out).toEqual([recentB, recentA]); // ascending, old excluded
  });
});
