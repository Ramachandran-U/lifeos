/**
 * Shared finance display helpers — formatting + category presentation used by
 * the Finance tab and the transaction drill-down screens. Kept in one place so
 * labels/colours stay consistent across surfaces.
 */

import type { TransactionCategory } from '@/ai/types';

export const CATEGORY_COLORS: Record<TransactionCategory, string> = {
  food_delivery: '#FF6B35',
  groceries: '#00C896',
  dining_out: '#F0B429',
  transport: '#00B4D8',
  fuel: '#FF4D8B',
  shopping: '#A855F7',
  subscriptions: '#5B4FE8',
  utilities: '#6B6B88',
  rent: '#F0B429',
  entertainment: '#FF4D8B',
  health: '#00C896',
  education: '#5B4FE8',
  travel: '#00B4D8',
  investments: '#F0B429',
  insurance: '#6B6B88',
  debt_repayment: '#FF4444',
  transfers: '#A8A8C0',
  income: '#00C896',
  gifts: '#FF4D8B',
  charity: '#A855F7',
  cash_withdrawal: '#F0B429',
  fees_charges: '#FF4444',
  personal_care: '#FF4D8B',
  other: '#6B6B88',
};

/** ₹ amount from paise, no decimals, Indian grouping. */
export function formatInr(paise: number): string {
  const r = paise / 100;
  return `₹${r.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function prettyCategory(cat: TransactionCategory): string {
  return cat
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function categoryColor(cat: string, fallback: string): string {
  return CATEGORY_COLORS[cat as TransactionCategory] ?? fallback;
}
