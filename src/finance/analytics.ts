/**
 * Pure transaction analytics for the drill-down screens — per-merchant and
 * per-category rollups, plus a cadence estimate ("about every N days"). No DB
 * or React here so it's fully unit-testable.
 */

export interface AnalyticsTx {
  date: string; // YYYY-MM-DD
  amount: number; // paise
  direction: 'debit' | 'credit';
  merchant: string;
  category: string;
}

export interface MerchantRollup {
  merchant: string;
  total: number; // paise (debits)
  count: number;
  firstDate: string;
  lastDate: string;
}

/** Aggregate debits per merchant, largest spend first. */
export function merchantRollups(txns: AnalyticsTx[]): MerchantRollup[] {
  const map = new Map<string, MerchantRollup>();
  for (const t of txns) {
    if (t.direction !== 'debit') continue;
    const cur = map.get(t.merchant);
    if (!cur) {
      map.set(t.merchant, {
        merchant: t.merchant,
        total: t.amount,
        count: 1,
        firstDate: t.date,
        lastDate: t.date,
      });
    } else {
      cur.total += t.amount;
      cur.count += 1;
      if (t.date < cur.firstDate) cur.firstDate = t.date;
      if (t.date > cur.lastDate) cur.lastDate = t.date;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

/**
 * Median gap in days between consecutive (sorted) dates, or null if fewer than
 * 2 distinct dates. Median (not mean) so one outlier gap doesn't skew it.
 */
export function cadenceDays(dates: string[]): number | null {
  const sorted = Array.from(new Set(dates)).sort();
  if (sorted.length < 2) return null;
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const ms = new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime();
    gaps.push(Math.round(ms / 86_400_000));
  }
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 ? gaps[mid] : Math.round((gaps[mid - 1] + gaps[mid]) / 2);
}

export interface PeriodWindows {
  /** First day of the current month (YYYY-MM-DD). */
  thisStart: string;
  /** Today — inclusive upper bound of the month-to-date window (YYYY-MM-DD). */
  thisEnd: string;
  /** First day of the previous month (YYYY-MM-DD). */
  prevStart: string;
  /**
   * Same day-of-month as today in the previous month, capped to that month's
   * last day (YYYY-MM-DD). Comparing the month-to-date window against
   * `prevStart..prevEnd` measures the *same number of elapsed days* last month
   * — so "spent ₹353 by the 4th" is judged against last month's 1st–4th, not
   * against the whole month (which made an in-progress month look like a crash).
   */
  prevEnd: string;
  /** Day-of-month covered so far (1-based) — useful for "1–N" range labels. */
  dayOfMonth: number;
}

/**
 * Month-to-date window and the equivalent same-length window of the previous
 * month. Pure (inject `now`). Date strings use UTC (`toISOString`) to match how
 * transaction `date`s are derived, so boundary comparisons stay consistent.
 */
export function samePeriodMonthWindows(now: Date): PeriodWindows {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const iso = (dt: Date) => dt.toISOString().slice(0, 10);

  const prevMonthLastDay = new Date(y, m, 0).getDate(); // day 0 of this month = last day of prev
  const prevEndDay = Math.min(d, prevMonthLastDay);

  return {
    thisStart: iso(new Date(y, m, 1)),
    thisEnd: iso(new Date(y, m, d)),
    prevStart: iso(new Date(y, m - 1, 1)),
    prevEnd: iso(new Date(y, m - 1, prevEndDay)),
    dayOfMonth: d,
  };
}

export interface CategoryRollup {
  total: number; // paise (debits)
  count: number;
  topMerchants: MerchantRollup[];
}

/** Roll up all debits for a single category, with its top merchants. */
export function categoryRollup(txns: AnalyticsTx[], topN = 5): CategoryRollup {
  const debits = txns.filter((t) => t.direction === 'debit');
  const total = debits.reduce((s, t) => s + t.amount, 0);
  return {
    total,
    count: debits.length,
    topMerchants: merchantRollups(debits).slice(0, topN),
  };
}
