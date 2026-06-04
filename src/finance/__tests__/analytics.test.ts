import {
  merchantRollups,
  cadenceDays,
  categoryRollup,
  samePeriodMonthWindows,
  type AnalyticsTx,
} from '../analytics';

const tx = (over: Partial<AnalyticsTx>): AnalyticsTx => ({
  date: '2026-05-01',
  amount: 1000,
  direction: 'debit',
  merchant: 'Swiggy',
  category: 'food_delivery',
  ...over,
});

describe('merchantRollups', () => {
  it('aggregates debits per merchant and sorts by spend', () => {
    const out = merchantRollups([
      tx({ merchant: 'Swiggy', amount: 300, date: '2026-05-01' }),
      tx({ merchant: 'Swiggy', amount: 500, date: '2026-05-09' }),
      tx({ merchant: 'Amazon', amount: 2000, date: '2026-05-05' }),
      tx({ merchant: 'Salary', amount: 99999, direction: 'credit' }), // ignored
    ]);
    expect(out[0].merchant).toBe('Amazon');
    expect(out[1]).toMatchObject({ merchant: 'Swiggy', total: 800, count: 2, firstDate: '2026-05-01', lastDate: '2026-05-09' });
    expect(out.find((m) => m.merchant === 'Salary')).toBeUndefined();
  });
});

describe('cadenceDays', () => {
  it('returns null with fewer than 2 distinct dates', () => {
    expect(cadenceDays(['2026-05-01'])).toBeNull();
    expect(cadenceDays(['2026-05-01', '2026-05-01'])).toBeNull();
  });
  it('returns the median gap', () => {
    // gaps: 30, 31 → median 31 (rounded mean of the two)
    expect(cadenceDays(['2026-01-01', '2026-01-31', '2026-03-03'])).toBe(31);
  });
  it('is robust to an outlier gap (median, not mean)', () => {
    // gaps: 7, 7, 90 → median 7
    expect(cadenceDays(['2026-01-01', '2026-01-08', '2026-01-15', '2026-04-15'])).toBe(7);
  });
  it('returns null for empty input', () => {
    expect(cadenceDays([])).toBeNull();
  });
  it('returns the gap for exactly 2 dates', () => {
    expect(cadenceDays(['2026-01-01', '2026-01-04'])).toBe(3);
  });
  it('handles consecutive days (cadence = 1)', () => {
    expect(cadenceDays(['2026-05-01', '2026-05-02', '2026-05-03'])).toBe(1);
  });
});

describe('samePeriodMonthWindows', () => {
  // Day-span between two YYYY-MM-DD strings is timezone-invariant, and the
  // boundaries are now formatted as LOCAL dates (localYmd), so the exact-string
  // assertions below also hold in any timezone — they'd fail under the old
  // toISOString formatting in a positive-offset TZ (the bug this guards).
  const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

  it('formats boundaries as the user\'s local dates (no UTC shift)', () => {
    const w = samePeriodMonthWindows(new Date(2026, 5, 4)); // local June 4
    expect(w).toMatchObject({
      thisStart: '2026-06-01',
      thisEnd: '2026-06-04', // == today, so an inclusive <= filter never drops today's txns
      prevStart: '2026-05-01',
      prevEnd: '2026-05-04',
      dayOfMonth: 4,
    });
  });

  it('compares equal-length windows for a mid-month date', () => {
    const w = samePeriodMonthWindows(new Date(2026, 5, 4)); // June 4
    expect(w.dayOfMonth).toBe(4);
    expect(days(w.thisStart, w.thisEnd)).toBe(3); // day 1 → day 4
    expect(days(w.prevStart, w.prevEnd)).toBe(3); // same elapsed span last month
  });

  it('caps the previous-month window at its last day (no 31st in February)', () => {
    const w = samePeriodMonthWindows(new Date(2026, 2, 31)); // March 31; Feb 2026 = 28 days
    expect(w.dayOfMonth).toBe(31);
    expect(days(w.thisStart, w.thisEnd)).toBe(30); // Mar 1 → Mar 31
    expect(days(w.prevStart, w.prevEnd)).toBe(27); // Feb 1 → Feb 28 (capped)
  });

  it('rolls over to the previous December in January', () => {
    const w = samePeriodMonthWindows(new Date(2026, 0, 10)); // Jan 10 2026
    expect(days(w.thisStart, w.thisEnd)).toBe(9);
    expect(days(w.prevStart, w.prevEnd)).toBe(9); // Dec 1 → Dec 10 2025
    expect(w.prevStart < w.thisStart).toBe(true);
  });
});

describe('categoryRollup', () => {
  it('totals debits and surfaces top merchants', () => {
    const out = categoryRollup([
      tx({ merchant: 'Swiggy', amount: 300 }),
      tx({ merchant: 'Zomato', amount: 700 }),
      tx({ merchant: 'Refund', amount: 500, direction: 'credit' }),
    ]);
    expect(out.total).toBe(1000);
    expect(out.count).toBe(2);
    expect(out.topMerchants[0].merchant).toBe('Zomato');
  });
});
