import type { MonthlyMoneyReview } from '../types';
import type { MoneyReviewInput } from '@/finance/moneyReview';

export function buildMockMoneyReview(input: MoneyReviewInput): MonthlyMoneyReview {
  const topCat = input.topCategories[0];
  const topMerchant = input.topMerchants[0];
  const wins: string[] = [];
  const leaks: string[] = [];

  if (input.net >= 0) wins.push(`Net positive — ₹${input.net.toLocaleString('en-IN')} left over this month.`);
  if (input.needsWantsSavings.savings > 0) wins.push(`Put ₹${input.needsWantsSavings.savings.toLocaleString('en-IN')} toward savings/investments.`);
  if (input.momDeltaPct != null && input.momDeltaPct < 0) wins.push(`Spending down ${Math.abs(input.momDeltaPct)}% vs last month.`);
  if (wins.length === 0) wins.push(`You logged ${input.transactionCount} transactions — the picture is clear, even if it was a tight month.`);

  if (topMerchant) leaks.push(`₹${topMerchant.amount.toLocaleString('en-IN')} at ${topMerchant.merchant} across ${topMerchant.count} payment${topMerchant.count === 1 ? '' : 's'}.`);
  if (topCat && topCat.category !== topMerchant?.merchant) leaks.push(`${topCat.category.replace(/_/g, ' ')} was your biggest category at ₹${topCat.amount.toLocaleString('en-IN')}.`);
  if (leaks.length === 0) leaks.push('No standout leaks this month.');

  const adjustment =
    input.needsWantsSavings.wants > input.needsWantsSavings.needs
      ? 'Wants outweighed needs — cap one discretionary category next month.'
      : topCat
        ? `Set a soft budget for ${topCat.category.replace(/_/g, ' ')} next month.`
        : 'Pick one category to watch next month.';

  return {
    headline:
      input.momDeltaPct != null
        ? `${input.monthLabel}: spent ₹${input.totalSpend.toLocaleString('en-IN')} (${input.momDeltaPct >= 0 ? '+' : ''}${input.momDeltaPct}% vs last month).`
        : `${input.monthLabel}: spent ₹${input.totalSpend.toLocaleString('en-IN')}.`,
    wins: wins.slice(0, 3),
    leaks: leaks.slice(0, 3),
    oneAdjustment: adjustment,
  };
}
