import { merchantRollups, cadenceDays, categoryRollup, type AnalyticsTx } from '../analytics';

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
