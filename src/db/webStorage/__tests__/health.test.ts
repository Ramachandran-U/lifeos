/**
 * webStorage/health — date filtering, weight-log filtering+ordering+limit,
 * food-entry update (id preservation) and delete, blood-report ordering.
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
  webInsertHealthLog,
  webGetHealthLogsByDate,
  webGetAllHealthLogs,
  webGetRecentWeightLogs,
  webInsertFoodEntry,
  webGetFoodEntriesByDate,
  webUpdateFoodEntry,
  webDeleteFoodEntry,
  webInsertBloodReport,
  webGetBloodReports,
  webGetBloodReportById,
  type WebHealthLog,
  type WebFoodEntry,
  type WebBloodReport,
} from '../health';

function log(over: Partial<WebHealthLog>): WebHealthLog {
  return {
    id: Math.random().toString(36).slice(2),
    date: '2026-05-27',
    source: 'manual',
    createdAt: '2026-05-27T00:00:00.000Z',
    ...over,
  };
}

function food(over: Partial<WebFoodEntry>): WebFoodEntry {
  return {
    id: Math.random().toString(36).slice(2),
    date: '2026-05-27',
    mealType: 'breakfast',
    foodName: 'Oats',
    quantityG: 100,
    calories: 350,
    protein: 12,
    carbs: 60,
    fat: 6,
    source: 'manual',
    createdAt: '2026-05-27T00:00:00.000Z',
    ...over,
  };
}

beforeEach(() => { localStorage.clear(); });

describe('health logs', () => {
  it('filters by date and reads all back', () => {
    webInsertHealthLog(log({ id: 'l1', date: '2026-05-27' }));
    webInsertHealthLog(log({ id: 'l2', date: '2026-05-28' }));
    expect(webGetHealthLogsByDate('2026-05-27').map((l) => l.id)).toEqual(['l1']);
    expect(webGetAllHealthLogs()).toHaveLength(2);
  });
});

describe('webGetRecentWeightLogs', () => {
  it('keeps only logs with a weight, sorts date DESC, and respects the limit', () => {
    webInsertHealthLog(log({ id: 'a', date: '2026-05-25', weight: 80 }));
    webInsertHealthLog(log({ id: 'b', date: '2026-05-27', weight: 79 }));
    webInsertHealthLog(log({ id: 'c', date: '2026-05-26', weight: null }));
    webInsertHealthLog(log({ id: 'd', date: '2026-05-28' })); // weight undefined
    const out = webGetRecentWeightLogs(2);
    expect(out.map((l) => l.id)).toEqual(['b', 'a']);
  });
});

describe('food entries', () => {
  it('filters by date, reads back inserted entry', () => {
    webInsertFoodEntry(food({ id: 'f1', date: '2026-05-27' }));
    webInsertFoodEntry(food({ id: 'f2', date: '2026-05-28' }));
    expect(webGetFoodEntriesByDate('2026-05-27').map((e) => e.id)).toEqual(['f1']);
  });

  it('updates fields while preserving the original id', () => {
    webInsertFoodEntry(food({ id: 'f1', calories: 350 }));
    webUpdateFoodEntry('f1', { calories: 500, id: 'attempted-clobber' });
    const [entry] = webGetFoodEntriesByDate('2026-05-27');
    expect(entry.id).toBe('f1');
    expect(entry.calories).toBe(500);
  });

  it('deletes by id', () => {
    webInsertFoodEntry(food({ id: 'f1' }));
    webInsertFoodEntry(food({ id: 'f2' }));
    webDeleteFoodEntry('f1');
    expect(webGetFoodEntriesByDate('2026-05-27').map((e) => e.id)).toEqual(['f2']);
  });
});

describe('blood reports', () => {
  function report(over: Partial<WebBloodReport>): WebBloodReport {
    return {
      id: Math.random().toString(36).slice(2),
      date: '2026-05-27',
      reportName: 'Annual panel',
      createdAt: '2026-05-27T00:00:00.000Z',
      ...over,
    };
  }

  it('lists reports newest-date-first and fetches by id', () => {
    webInsertBloodReport(report({ id: 'r1', date: '2026-01-01' }));
    webInsertBloodReport(report({ id: 'r2', date: '2026-05-01' }));
    webInsertBloodReport(report({ id: 'r3', date: '2026-03-01' }));
    expect(webGetBloodReports().map((r) => r.id)).toEqual(['r2', 'r3', 'r1']);
    expect(webGetBloodReportById('r3')?.date).toBe('2026-03-01');
    expect(webGetBloodReportById('missing')).toBeUndefined();
  });
});
