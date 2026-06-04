/**
 * Pure presentation helpers for the subscriptions & bills audit. No I/O, no
 * `Date.now` (callers pass a reference date), so it's deterministic and
 * node-testable — the SubscriptionsBillsCard is then a thin view over this.
 */

import type { RecurringItemRecord } from '@/finance/db/transactionDb';

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Normalise a billing amount (paise) to a monthly figure for the audit total. */
export function monthlyAmountPaise(amount: number, cadence: string | null): number {
  switch (cadence) {
    case 'yearly':
      return Math.round(amount / 12);
    case 'quarterly':
      return Math.round(amount / 3);
    case 'weekly':
      return Math.round((amount * 52) / 12);
    case 'monthly':
    default:
      // Unknown cadence on a subscription is treated as monthly (the common case).
      return amount;
  }
}

export interface RecurringSummary {
  subscriptions: RecurringItemRecord[];
  bills: RecurringItemRecord[];
  /** Normalised monthly cost of all subscriptions, in paise. */
  monthlySubscriptionTotalPaise: number;
}

function byDueDate(a: RecurringItemRecord, b: RecurringItemRecord): number {
  return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
}

export function summarizeRecurring(items: RecurringItemRecord[]): RecurringSummary {
  const subscriptions = items.filter((i) => i.kind === 'subscription').sort(byDueDate);
  const bills = items.filter((i) => i.kind === 'bill').sort(byDueDate);
  const monthlySubscriptionTotalPaise = subscriptions.reduce(
    (sum, s) => sum + monthlyAmountPaise(s.amount, s.cadence),
    0,
  );
  return { subscriptions, bills, monthlySubscriptionTotalPaise };
}

function isoToUtcDays(iso: string): number | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000;
}

/**
 * Human label for a due/renewal date, relative to `todayIso` (YYYY-MM-DD).
 * Returns '' when there's no date. Pure — `todayIso` is passed in.
 */
export function formatDueLabel(dueDate: string | null, todayIso: string): string {
  if (!dueDate) return '';
  const due = isoToUtcDays(dueDate);
  const today = isoToUtcDays(todayIso);
  if (due == null || today == null) return '';

  const days = due - today;
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days <= 14) return `Due in ${days} days`;

  const [, , mo, d] = dueDate.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  const month = MONTH_SHORT[Number(mo) - 1];
  return month ? `Due ${Number(d)} ${month}` : '';
}
