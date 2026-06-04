/**
 * Pure transaction analytics for the drill-down screens — per-merchant and
 * per-category rollups, plus a cadence estimate ("about every N days"). No DB
 * or React here so it's fully unit-testable.
 */

import { localYmd } from '@/utils/dateKeys';

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
 * month. Pure (inject `now`). Boundaries are formatted as LOCAL dates (`localYmd`,
 * NOT `toISOString`): in a positive-UTC-offset timezone (e.g. IST), local midnight
 * is the *previous* UTC day, so a UTC-shifted `thisEnd` would fall before a
 * UTC-dated "today" transaction and the inclusive `<= thisEnd` filter would drop
 * it. Local formatting keeps `thisEnd` = the user's wall-clock today, ≥ any of
 * today's transaction dates.
 */
export function samePeriodMonthWindows(now: Date): PeriodWindows {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  const prevMonthLastDay = new Date(y, m, 0).getDate(); // day 0 of this month = last day of prev
  const prevEndDay = Math.min(d, prevMonthLastDay);

  return {
    thisStart: localYmd(new Date(y, m, 1)),
    thisEnd: localYmd(new Date(y, m, d)),
    prevStart: localYmd(new Date(y, m - 1, 1)),
    prevEnd: localYmd(new Date(y, m - 1, prevEndDay)),
    dayOfMonth: d,
  };
}

export interface PeriodSplit<T> {
  thisMonth: T[];
  lastPeriod: T[];
  windows: PeriodWindows;
}

/**
 * Split transactions into the month-to-date window and the equivalent same-length
 * window of last month, using {@link samePeriodMonthWindows}. The single tested
 * home for the `date >= start && date <= end` filter that both the Finance
 * overview and the money review apply — so the TZ-boundary handling lives (and is
 * tested) in one place instead of being copy-pasted at each call site.
 */
export function splitTxByPeriod<T extends { date: string }>(txns: T[], now: Date): PeriodSplit<T> {
  const windows = samePeriodMonthWindows(now);
  const { thisStart, thisEnd, prevStart, prevEnd } = windows;
  return {
    thisMonth: txns.filter((t) => t.date >= thisStart && t.date <= thisEnd),
    lastPeriod: txns.filter((t) => t.date >= prevStart && t.date <= prevEnd),
    windows,
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
