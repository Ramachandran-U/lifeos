/**
 * Builds the input payload for the Monthly Money Review AI from on-device
 * transactions. Pure + deterministic (inject `now`) so it's unit-testable.
 * Amounts are converted paise → rupees here so the prompt deals in plain
 * currency units.
 */

import { isConsumptionSpend, spendByGroup, spendByAxis, GROUP_META } from './categoryGroups';
import { merchantRollups, samePeriodMonthWindows } from './analytics';
import type { TransactionCategory } from '@/ai/types';

export interface MoneyReviewTx {
  date: string; // YYYY-MM-DD
  amount: number; // paise
  direction: 'debit' | 'credit';
  merchant: string;
  category: string;
}

export interface MoneyReviewInput {
  monthLabel: string;
  totalSpend: number; // rupees
  income: number;
  net: number;
  momDeltaPct: number | null;
  byGroup: Array<{ group: string; amount: number; pct: number }>;
  needsWantsSavings: { needs: number; wants: number; savings: number };
  topCategories: Array<{ category: string; amount: number }>;
  topMerchants: Array<{ merchant: string; amount: number; count: number }>;
  transactionCount: number;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const toRupees = (paise: number) => Math.round(paise / 100);

export function buildMoneyReviewInput(txns: MoneyReviewTx[], now: Date = new Date()): MoneyReviewInput {
  // Compare like-for-like: month-to-date vs the SAME day-range last month, so an
  // in-progress month isn't judged against a full previous month (which made
  // "spent ₹353 by the 4th" read as a spend collapse). See samePeriodMonthWindows.
  const { thisStart, thisEnd, prevStart, prevEnd } = samePeriodMonthWindows(now);

  const thisMonth = txns.filter((t) => t.date >= thisStart && t.date <= thisEnd);
  const lastMonth = txns.filter((t) => t.date >= prevStart && t.date <= prevEnd);

  const minimal = (t: MoneyReviewTx) => ({
    amount: t.amount,
    direction: t.direction,
    category: t.category as TransactionCategory,
  });

  const spendPaise = thisMonth.reduce(
    (s, t) => (isConsumptionSpend(t.category as TransactionCategory, t.direction) ? s + t.amount : s),
    0,
  );
  const lastSpendPaise = lastMonth.reduce(
    (s, t) => (isConsumptionSpend(t.category as TransactionCategory, t.direction) ? s + t.amount : s),
    0,
  );
  const incomePaise = thisMonth.filter((t) => t.direction === 'credit').reduce((s, t) => s + t.amount, 0);

  const groups = spendByGroup(thisMonth.map(minimal));
  const axis = spendByAxis(thisMonth.map(minimal));

  const byCat = new Map<string, number>();
  for (const t of thisMonth) {
    if (!isConsumptionSpend(t.category as TransactionCategory, t.direction)) continue;
    byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
  }
  const topCategories = Array.from(byCat.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, amount]) => ({ category, amount: toRupees(amount) }));

  const topMerchants = merchantRollups(
    thisMonth
      .filter((t) => isConsumptionSpend(t.category as TransactionCategory, t.direction))
      .map((t) => ({ date: t.date, amount: t.amount, direction: t.direction, merchant: t.merchant, category: t.category })),
  )
    .slice(0, 5)
    .map((m) => ({ merchant: m.merchant, amount: toRupees(m.total), count: m.count }));

  return {
    monthLabel: `${MONTHS[now.getMonth()]} ${now.getFullYear()}`,
    totalSpend: toRupees(spendPaise),
    income: toRupees(incomePaise),
    net: toRupees(incomePaise - spendPaise),
    momDeltaPct: lastSpendPaise > 0 ? Math.round(((spendPaise - lastSpendPaise) / lastSpendPaise) * 100) : null,
    byGroup: groups.map((g) => ({
      group: GROUP_META[g.group].label,
      amount: toRupees(g.amount),
      pct: spendPaise > 0 ? Math.round((g.amount / spendPaise) * 100) : 0,
    })),
    needsWantsSavings: {
      needs: toRupees(axis.needs),
      wants: toRupees(axis.wants),
      savings: toRupees(axis.savings),
    },
    topCategories,
    topMerchants,
    transactionCount: thisMonth.length,
  };
}
