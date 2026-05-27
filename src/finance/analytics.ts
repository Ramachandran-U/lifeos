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
