/**
 * Surfaces upcoming bills & subscription renewals (ingested from Gmail into the
 * recurringItems store) to the planning pipeline — the routine planner's
 * retrieve step and the "what should I do next?" agent — so a payment due soon
 * can become a routine block or the recommended next action.
 *
 * Mirrors calendarContext.ts: a defensive async fetch (`fetchActiveRecurring`,
 * never throws — returns null when the store is unavailable, e.g. native where
 * the finance DB is web-only) plus pure, node-tested selectors/formatters.
 */

import { Platform } from 'react-native';
import type { RagItem } from './rag/retrieve';
import type { RecurringItemRecord, RecurringKind } from '@/finance/db/transactionDb';
import { getActiveRecurringItems } from '@/finance/db/transactionDb';
import { formatDueLabel } from '@/finance/recurringSummary';
import { formatInr } from '@/finance/display';
import { todayKey, isoToUtcDays } from '@/utils/dateKeys';

/** Bills due / subscriptions renewing within this many days count as "upcoming". */
const DEFAULT_WINDOW_DAYS = 7;
/** Stop surfacing an overdue item once it's more than this many days past due —
 *  a weeks-old un-dismissed bill shouldn't nag as a next-action forever. */
const OVERDUE_GRACE_DAYS = 14;

/**
 * Read the active (non-dismissed) recurring items. Returns null when the store
 * is unavailable — native (the finance DB is web-only) or any read error — so
 * callers degrade to "no bills context" instead of throwing.
 */
export async function fetchActiveRecurring(): Promise<RecurringItemRecord[] | null> {
  if (Platform.OS !== 'web') return null;
  try {
    return await getActiveRecurringItems();
  } catch {
    return null;
  }
}


/**
 * Pure: items with a due date that is overdue or within `withinDays`, soonest
 * first. Items without a due date are dropped (nothing time-sensitive to act on).
 */
export function selectUpcomingRecurring(
  items: RecurringItemRecord[],
  todayIso: string,
  withinDays = DEFAULT_WINDOW_DAYS,
): RecurringItemRecord[] {
  const today = isoToUtcDays(todayIso);
  if (today == null) return [];
  return items
    .filter((i) => {
      if (!i.dueDate) return false;
      const d = isoToUtcDays(i.dueDate);
      if (d == null) return false;
      const delta = d - today;
      return delta <= withinDays && delta >= -OVERDUE_GRACE_DAYS; // recently overdue → +withinDays
    })
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
}

/** Pure: one consolidated planner-context sentence (or [] when nothing is due). */
export function recurringToRagItems(items: RecurringItemRecord[], todayIso: string): RagItem[] {
  if (items.length === 0) return [];
  const parts = items.map((i) => {
    const amt = i.amount > 0 ? ` ${formatInr(i.amount)}` : '';
    const noun = i.kind === 'subscription' ? `${i.merchant}${amt} renews` : `${i.merchant}${amt}`;
    const due = formatDueLabel(i.dueDate, todayIso);
    return due ? `${noun} (${due})` : noun;
  });
  return [
    {
      id: `bills:upcoming:${todayIso}`,
      text:
        `Upcoming bills and subscription renewals to account for: ${parts.join('; ')}. ` +
        `If a payment is due soon, consider a short block to handle it.`,
      metadata: { kind: 'bills', count: items.length },
    },
  ];
}

/**
 * Planner context: upcoming bills/renewals as RagItems. Always resolves to []
 * when the store is unavailable — never blocks planning.
 */
export async function buildBillsContext(todayIso: string = todayKey()): Promise<RagItem[]> {
  const items = await fetchActiveRecurring();
  if (!items) return [];
  return recurringToRagItems(selectUpcomingRecurring(items, todayIso), todayIso);
}

export interface UpcomingBillView {
  kind: RecurringKind;
  merchant: string;
  /** Formatted ₹ amount, or null when no amount was parsed. */
  amount: string | null;
  /** Relative due label (e.g. "Due in 2 days"), or null. */
  due: string | null;
}

/** Agent-tool view: compact upcoming bills/renewals. [] when unavailable. */
export async function getUpcomingBillsForAgent(todayIso: string): Promise<UpcomingBillView[]> {
  const items = await fetchActiveRecurring();
  if (!items) return [];
  return selectUpcomingRecurring(items, todayIso).map((i) => ({
    kind: i.kind,
    merchant: i.merchant,
    amount: i.amount > 0 ? formatInr(i.amount) : null,
    due: formatDueLabel(i.dueDate, todayIso) || null,
  }));
}
