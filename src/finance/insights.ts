/**
 * Tier-1 behavioural insight detectors (Paisa Sense spec).
 * Each detector returns `null` if nothing noteworthy was found.
 * Amounts are in paise (integer) throughout.
 */

import type { TxRecord } from '@/finance/db/transactionDb';

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
    const key = `${t.merchant.toLowerCase()}|${t.amount}`;
    const bucket = byMerchant.get(key) ?? [];
    bucket.push(t);
    byMerchant.set(key, bucket);
  }

  const recurring: Array<{ merchant: string; amount: number; count: number }> = [];
  for (const [key, list] of byMerchant) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    let monthlyLike = 0;
    for (let i = 1; i < sorted.length; i++) {
      const days = daysBetween(sorted[i - 1].date, sorted[i].date);
      if (days >= 25 && days <= 35) monthlyLike++;
    }
    if (monthlyLike >= 1) {
      const [merchant] = key.split('|');
      recurring.push({ merchant, amount: list[0].amount, count: list.length });
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
): Insight | null {
  if (!plan || plan.monthlyTarget <= 0 || txns.length === 0) return null;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = now.toISOString().slice(0, 10);
  const thisMonth = txns.filter((t) => t.date >= monthStart && t.date <= monthEnd);
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
    for (let i = 1; i < sorted.length; i++) {
      const gap = daysBetween(sorted[i - 1].date, sorted[i].date);
      if (gap <= 1) {
        const [merchant] = key.split('|');
        dupes.push({ merchant, amount: sorted[i].amount, count: 2 });
        break;
      }
    }
  }

  if (dupes.length === 0) return null;
  const total = dupes.reduce((s, d) => s + d.amount, 0);

  return {
    id: 'duplicate_payments',
    title: 'Possible duplicate payment',
    body: `We spotted ${dupes.length} same-amount payments to the same merchant within 24 hours (₹${(total / PAISE).toLocaleString('en-IN')}). Check whether any were charged twice by mistake.`,
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
