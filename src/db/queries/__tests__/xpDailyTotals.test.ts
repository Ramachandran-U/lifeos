/**
 * getXpDailyTotals — per-day ledger bucketing with zero-fill (M4 chart feed).
 * Runs the web path (localStorage shim), mirroring the other query suites.
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

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

import { format, subDays } from 'date-fns';
import { getXpDailyTotals } from '../xpEvents';
import { webInsertXpEvent, type WebXpEvent } from '../../webStorage/xpEvents';

const NOW = new Date('2026-06-10T12:00:00');
const dayAgo = (n: number) => format(subDays(NOW, n), 'yyyy-MM-dd');

function event(dayLocal: string, amount: number): WebXpEvent {
  return {
    id: Math.random().toString(36).slice(2),
    userId: 'u1',
    amount,
    domain: null,
    source: 'block',
    refId: null,
    dayLocal,
    createdAt: `${dayLocal}T10:00:00.000Z`,
    updatedAt: `${dayLocal}T10:00:00.000Z`,
  };
}

beforeEach(() => {
  (globalThis as { localStorage: { clear: () => void } }).localStorage.clear();
});

describe('getXpDailyTotals', () => {
  test('sums multiple grants per day and zero-fills quiet days', () => {
    webInsertXpEvent(event(dayAgo(2), 10));
    webInsertXpEvent(event(dayAgo(2), 15));
    webInsertXpEvent(event(dayAgo(0), 40));

    const series = getXpDailyTotals('u1', 3, NOW);
    expect(series).toEqual([
      { day: dayAgo(2), xp: 25 },
      { day: dayAgo(1), xp: 0 },
      { day: dayAgo(0), xp: 40 },
    ]);
  });

  test('ignores events outside the window and from other users', () => {
    webInsertXpEvent(event(dayAgo(10), 99));
    webInsertXpEvent({ ...event(dayAgo(0), 50), userId: 'someone-else' });

    const series = getXpDailyTotals('u1', 3, NOW);
    expect(series.every((p) => p.xp === 0)).toBe(true);
    expect(series).toHaveLength(3);
  });
});
