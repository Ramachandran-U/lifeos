/** Web spark storage: one per user per day, recent-title dedup feed, status updates. */
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
  webInsertSpark,
  webGetSparkByDate,
  webListRecentSparks,
  webUpdateSparkStatus,
  type WebSpark,
} from '../sparks';
import { format, subDays } from 'date-fns';

function spark(over: Partial<WebSpark>): WebSpark {
  return {
    id: 's1', userId: 'u1', date: format(new Date(), 'yyyy-MM-dd'),
    title: 'The hidden grammar of chess', body: 'b', threadStarter: 'q?',
    seedInterest: 'chess', adjacentField: 'linguistics', status: 'new', threadId: null,
    createdAt: '2026-05-27T00:00:00.000Z', ...over,
  };
}

it('stores and fetches today\'s spark by user+date', () => {
  const today = format(new Date(), 'yyyy-MM-dd');
  webInsertSpark(spark({ date: today }));
  expect(webGetSparkByDate('u1', today)?.title).toBe('The hidden grammar of chess');
  expect(webGetSparkByDate('u2', today)).toBeUndefined();
});

it('lists recent sparks within the window, newest first', () => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const old = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  webInsertSpark(spark({ id: 'a', date: today, title: 'Today' }));
  webInsertSpark(spark({ id: 'b', date: old, title: 'Old' }));
  const recent = webListRecentSparks('u1', 14);
  expect(recent.map((s) => s.title)).toEqual(['Today']); // old one outside window
});

it('updates status and threadId', () => {
  webInsertSpark(spark({ id: 'x' }));
  webUpdateSparkStatus('x', 'explored', 'thread_42');
  const today = format(new Date(), 'yyyy-MM-dd');
  const s = webGetSparkByDate('u1', today);
  expect(s?.status).toBe('explored');
  expect(s?.threadId).toBe('thread_42');
});
