/**
 * Tier-1 behavioural insight detectors (Paisa Sense spec).
 * Each detector returns `null` if nothing noteworthy was found.
 * Amounts are in paise (integer) throughout.
 */

import type { TxRecord } from '@/finance/db/transactionDb';
import { samePeriodMonthWindows } from '@/finance/analytics';

export interface Insight {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'notice' | 'warning' | 'alert';
  amount?: number;
  actionLabel?: string;
}

const PAISE = 100;
const RUPEES = (p: number) => `₹${(p / PAISE).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// ─── Micro-spend leak ───────────────────────────────────────────────────────
// Flags if sum of debits < ₹200 exceeds ₹2000/month.

export function detectMicroSpendLeak(txns: TxRecord[]): Insight | null {
  const micro = txns.filter(
    (t) => t.direction === 'debit' && t.amount > 0 && t.amount < 200 * PAISE,
  );
  if (micro.length < 5) return null;

  const total = micro.reduce((sum, t) => sum + t.amount, 0);
  if (total < 2000 * PAISE) return null;

  return {
    id: 'microspend_leak',
    title: 'Small spends are adding up',
    body: `You've made ${micro.length} small transactions under ₹200 totalling ${RUPEES(total)} recently. Cutting even half of these would save ${RUPEES(Math.round(total / 2))}.`,
    severity: 'warning',
    amount: total,
    actionLabel: 'See transactions',
  };
}

// ─── Recurring subscriptions ────────────────────────────────────────────────
// Finds same-amount debits to the same merchant recurring ~monthly.

export function detectSubscriptions(txns: TxRecord[]): Insight | null {
  const debits = txns.filter((t) => t.direction === 'debit');
  const byMerchant = new Map<string, TxRecord[]>();
  for (const t of debits) {
    // Key by MERCHANT ONLY (not merchant|amount): a plan price change
    // (₹649→₹699) or an FX-rounded charge must not fragment the series into
    // separate buckets and hide the recurring monthly cadence.
    const key = t.merchant.toLowerCase();
    const bucket = byMerchant.get(key) ?? [];
    bucket.push(t);
    byMerchant.set(key, bucket);
  }

  const recurring: Array<{ merchant: string; amount: number; count: number }> = [];
  for (const [merchant, list] of byMerchant) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    // Only a subscription if amounts are CLOSE (≤25% spread): tolerate a price
    // bump but reject merchants with wildly varying spend (groceries, fuel) that
    // merely happen to recur ~monthly.
    const amounts = sorted.map((t) => t.amount);
    if (Math.max(...amounts) > Math.min(...amounts) * 1.25) continue;
    let monthlyLike = 0;
    for (let i = 1; i < sorted.length; i++) {
      const days = daysBetween(sorted[i - 1].date, sorted[i].date);
      if (days >= 25 && days <= 35) monthlyLike++;
    }
    if (monthlyLike >= 1) {
      // Report the most recent charge as the current price.
      recurring.push({ merchant, amount: amounts[amounts.length - 1], count: list.length });
    }
  }

  if (recurring.length === 0) return null;
  const monthly = recurring.reduce((sum, r) => sum + r.amount, 0);

  return {
    id: 'subscriptions',
    title: `${recurring.length} recurring subscriptions detected`,
    body: `You're paying roughly ${RUPEES(monthly)} per month in subscriptions. Review them to make sure each one still earns its keep.`,
    severity: 'notice',
    amount: monthly,
    actionLabel: 'Review',
  };
}

// ─── True savings rate ──────────────────────────────────────────────────────
// Compares actual net savings (credits − debits) against monthly plan target.

export interface SavingsPlan {
  monthlyTarget: number;
}

export function detectTrueSavingsRate(
  txns: TxRecord[],
  plan: SavingsPlan | null,
  now: Date = new Date(),
): Insight | null {
  if (!plan || plan.monthlyTarget <= 0 || txns.length === 0) return null;

  // LOCAL month-to-date window. The old code formatted the boundaries with
  // toISOString() (UTC): in a positive-offset timezone (e.g. IST) local midnight
  // is the previous UTC day, so monthStart could include the previous month's
  // last day and a UTC-shifted monthEnd could drop a transaction dated "today" —
  // a wrong net-savings figure (and possibly the wrong ahead/behind verdict).
  // samePeriodMonthWindows formats local dates (see its docblock) — the same fix
  // analytics already uses for its period windows.
  const { thisStart, thisEnd } = samePeriodMonthWindows(now);
  const thisMonth = txns.filter((t) => t.date >= thisStart && t.date <= thisEnd);
  if (thisMonth.length === 0) return null;

  const credits = thisMonth.filter((t) => t.direction === 'credit').reduce((s, t) => s + t.amount, 0);
  const debits = thisMonth.filter((t) => t.direction === 'debit').reduce((s, t) => s + t.amount, 0);
  const netPaise = credits - debits;
  const net = Math.round(netPaise / PAISE);
  const target = plan.monthlyTarget;

  if (net >= target) {
    return {
      id: 'savings_ahead',
      title: 'You are ahead of plan',
      body: `Net savings this month are ${RUPEES(netPaise)} against a target of ₹${target.toLocaleString('en-IN')}. Keep the momentum going.`,
      severity: 'info',
      amount: netPaise,
    };
  }

  return {
    id: 'savings_behind',
    title: 'Savings are behind target',
    body: `You've netted ${RUPEES(netPaise)} so far this month versus a target of ₹${target.toLocaleString('en-IN')}. Trim discretionary spending to close the gap.`,
    severity: net < 0 ? 'alert' : 'warning',
    amount: netPaise,
    actionLabel: 'See where it went',
  };
}

// ─── Duplicate payments ─────────────────────────────────────────────────────
// Same amount + same merchant within 24 hours.

export function detectDuplicatePayments(txns: TxRecord[]): Insight | null {
  const debits = txns.filter((t) => t.direction === 'debit');
  const dupes: Array<{ merchant: string; amount: number; count: number }> = [];

  const byKey = new Map<string, TxRecord[]>();
  for (const t of debits) {
    const key = `${t.merchant.toLowerCase()}|${t.amount}`;
    const bucket = byKey.get(key) ?? [];
    bucket.push(t);
    byKey.set(key, bucket);
  }

  for (const [key, list] of byKey) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    // Count EVERY charge that lands within a day of the previous one — these are
    // the suspected extra (duplicate) charges. The old code hard-coded count:2
    // and broke after the first pair, so 3+ same-day identical charges were
    // under-reported and the at-risk total only ever counted one extra charge.
    let extraCount = 0;
    let extraAmount = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (daysBetween(sorted[i - 1].date, sorted[i].date) <= 1) {
        extraCount += 1;
        extraAmount += sorted[i].amount;
      }
    }
    if (extraCount > 0) {
      const [merchant] = key.split('|');
      dupes.push({ merchant, amount: extraAmount, count: extraCount });
    }
  }

  if (dupes.length === 0) return null;
  const extraCharges = dupes.reduce((s, d) => s + d.count, 0);
  const total = dupes.reduce((s, d) => s + d.amount, 0);

  return {
    id: 'duplicate_payments',
    title: 'Possible duplicate payment',
    body: `We spotted ${extraCharges} possible duplicate charge${extraCharges === 1 ? '' : 's'} (same amount, same merchant, within a day) totalling ₹${(total / PAISE).toLocaleString('en-IN')}. Check whether any were charged twice by mistake.`,
    severity: 'alert',
    amount: total,
    actionLabel: 'Review',
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.abs(Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function runAllDetectors(
  txns: TxRecord[],
  plan: SavingsPlan | null,
): Insight[] {
  return [
    detectMicroSpendLeak(txns),
    detectSubscriptions(txns),
    detectTrueSavingsRate(txns, plan),
    detectDuplicatePayments(txns),
  ].filter((x): x is Insight => x !== null);
}
