/**
 * Two-level finance taxonomy + spending lenses.
 *
 * The 24 flat transaction categories are useful for tagging but too granular
 * for an overview. This module rolls them into 6 spending GROUPS and tags each
 * with a 50/30/20 AXIS (needs / wants / savings), and defines which categories
 * actually represent consumption (so self-transfers, investments, and loan/card
 * repayments don't inflate the "spend" headline).
 *
 * Pure + deterministic so it's unit-testable and shared by the overview,
 * the category drill-downs, and the monthly review.
 */

import type { TransactionCategory } from '@/ai/types';

export type CategoryGroup =
  | 'essentials'
  | 'lifestyle'
  | 'financial'
  | 'transfers'
  | 'income'
  | 'other';

/** 50/30/20 lens. `excluded` = not part of the needs/wants/savings ratio. */
export type SpendAxis = 'needs' | 'wants' | 'savings' | 'excluded';

export const CATEGORY_GROUP: Record<TransactionCategory, CategoryGroup> = {
  // Essentials — recurring cost of living
  groceries: 'essentials',
  rent: 'essentials',
  utilities: 'essentials',
  fuel: 'essentials',
  health: 'essentials',
  insurance: 'essentials',
  transport: 'essentials',
  // Lifestyle — discretionary
  food_delivery: 'lifestyle',
  dining_out: 'lifestyle',
  shopping: 'lifestyle',
  subscriptions: 'lifestyle',
  entertainment: 'lifestyle',
  personal_care: 'lifestyle',
  travel: 'lifestyle',
  education: 'lifestyle',
  gifts: 'lifestyle',
  charity: 'lifestyle',
  // Financial — wealth / obligations
  investments: 'financial',
  debt_repayment: 'financial',
  fees_charges: 'financial',
  // Money movement
  transfers: 'transfers',
  cash_withdrawal: 'transfers',
  // Inbound
  income: 'income',
  // Fallback
  other: 'other',
};

export const CATEGORY_AXIS: Record<TransactionCategory, SpendAxis> = {
  // Needs
  groceries: 'needs',
  rent: 'needs',
  utilities: 'needs',
  fuel: 'needs',
  health: 'needs',
  insurance: 'needs',
  transport: 'needs',
  education: 'needs',
  debt_repayment: 'needs',
  fees_charges: 'needs',
  // Wants
  food_delivery: 'wants',
  dining_out: 'wants',
  shopping: 'wants',
  subscriptions: 'wants',
  entertainment: 'wants',
  personal_care: 'wants',
  travel: 'wants',
  gifts: 'wants',
  charity: 'wants',
  // Savings
  investments: 'savings',
  // Not part of the ratio
  transfers: 'excluded',
  cash_withdrawal: 'excluded',
  income: 'excluded',
  other: 'excluded',
};

export const GROUP_META: Record<CategoryGroup, { label: string; colorKey: string }> = {
  essentials: { label: 'Essentials', colorKey: '#00C896' },
  lifestyle: { label: 'Lifestyle', colorKey: '#FF6B35' },
  financial: { label: 'Financial', colorKey: '#F0B429' },
  transfers: { label: 'Transfers & Cash', colorKey: '#A8A8C0' },
  income: { label: 'Income', colorKey: '#00C896' },
  other: { label: 'Other', colorKey: '#6B6B88' },
};

/**
 * Categories that move money without being consumption — excluded from the
 * "spend" headline so a ₹50k self-transfer or SIP doesn't read as spending.
 * Cash withdrawal IS counted as spend (the money left the account and is
 * typically consumed off-ledger).
 */
const NON_CONSUMPTION: ReadonlySet<TransactionCategory> = new Set([
  'transfers',
  'investments',
  'debt_repayment',
]);

/** True if a debit in this category counts toward consumption "spend". */
export function isConsumptionSpend(
  category: TransactionCategory,
  direction: 'debit' | 'credit',
): boolean {
  return direction === 'debit' && !NON_CONSUMPTION.has(category);
}

export interface MinimalTx {
  amount: number; // paise
  direction: 'debit' | 'credit';
  category: TransactionCategory;
}

/** Sum consumption spend (paise) over the given transactions. */
export function totalConsumptionSpend(txns: MinimalTx[]): number {
  return txns.reduce(
    (sum, t) => (isConsumptionSpend(t.category, t.direction) ? sum + t.amount : sum),
    0,
  );
}

/** Group consumption spend (paise) by CategoryGroup, descending. */
export function spendByGroup(txns: MinimalTx[]): Array<{ group: CategoryGroup; amount: number }> {
  const map = new Map<CategoryGroup, number>();
  for (const t of txns) {
    if (!isConsumptionSpend(t.category, t.direction)) continue;
    const g = CATEGORY_GROUP[t.category];
    map.set(g, (map.get(g) ?? 0) + t.amount);
  }
  return Array.from(map.entries())
    .map(([group, amount]) => ({ group, amount }))
    .sort((a, b) => b.amount - a.amount);
}

/** Needs/wants/savings split (paise) over consumption + savings transactions. */
export function spendByAxis(txns: MinimalTx[]): Record<'needs' | 'wants' | 'savings', number> {
  const out = { needs: 0, wants: 0, savings: 0 };
  for (const t of txns) {
    if (t.direction !== 'debit') continue;
    const axis = CATEGORY_AXIS[t.category];
    if (axis === 'needs' || axis === 'wants' || axis === 'savings') {
      out[axis] += t.amount;
    }
  }
  return out;
}
