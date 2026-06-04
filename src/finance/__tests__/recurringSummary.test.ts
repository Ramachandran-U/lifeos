import {
  summarizeRecurring,
  monthlyAmountPaise,
  formatDueLabel,
} from '../recurringSummary';
import type { RecurringItemRecord } from '@/finance/db/transactionDb';

function item(over: Partial<RecurringItemRecord>): RecurringItemRecord {
  return {
    id: 'i1',
    kind: 'subscription',
    merchant: 'Acme',
    amount: 10000,
    dueDate: null,
    cadence: 'monthly',
    rawEmailId: 'i1',
    confidence: 0.9,
    dismissed: false,
    detectedAt: '2026-06-01T00:00:00.000Z',
    ...over,
  };
}

describe('monthlyAmountPaise', () => {
  it('passes monthly through and defaults unknown cadence to monthly', () => {
    expect(monthlyAmountPaise(64900, 'monthly')).toBe(64900);
    expect(monthlyAmountPaise(64900, null)).toBe(64900);
  });
  it('normalises yearly, quarterly, and weekly to a monthly figure', () => {
    expect(monthlyAmountPaise(120000, 'yearly')).toBe(10000);
    expect(monthlyAmountPaise(30000, 'quarterly')).toBe(10000);
    expect(monthlyAmountPaise(2300, 'weekly')).toBe(Math.round((2300 * 52) / 12));
  });
});

describe('summarizeRecurring', () => {
  it('splits subscriptions vs bills, sorts each by due date, and totals monthly subs', () => {
    const out = summarizeRecurring([
      item({ id: 'a', kind: 'subscription', amount: 64900, cadence: 'monthly', dueDate: '2026-06-20' }),
      item({ id: 'b', kind: 'bill', amount: 99900, cadence: null, dueDate: '2026-06-28' }),
      item({ id: 'c', kind: 'subscription', amount: 120000, cadence: 'yearly', dueDate: '2026-06-10' }),
    ]);

    expect(out.subscriptions.map((s) => s.id)).toEqual(['c', 'a']); // sorted by dueDate
    expect(out.bills.map((b) => b.id)).toEqual(['b']);
    // 64900 (monthly) + 120000/12 (yearly) = 74900
    expect(out.monthlySubscriptionTotalPaise).toBe(74900);
  });

  it('puts items without a due date last', () => {
    const out = summarizeRecurring([
      item({ id: 'nodate', kind: 'bill', dueDate: null }),
      item({ id: 'dated', kind: 'bill', dueDate: '2026-07-01' }),
    ]);
    expect(out.bills.map((b) => b.id)).toEqual(['dated', 'nodate']);
  });
});

describe('formatDueLabel', () => {
  const today = '2026-06-10';
  it('returns empty string when there is no date', () => {
    expect(formatDueLabel(null, today)).toBe('');
  });
  it('flags overdue / today / tomorrow', () => {
    expect(formatDueLabel('2026-06-09', today)).toBe('Overdue');
    expect(formatDueLabel('2026-06-10', today)).toBe('Due today');
    expect(formatDueLabel('2026-06-11', today)).toBe('Due tomorrow');
  });
  it('counts days within two weeks', () => {
    expect(formatDueLabel('2026-06-17', today)).toBe('Due in 7 days');
  });
  it('formats a far date as "Due D Mon"', () => {
    expect(formatDueLabel('2026-07-28', today)).toBe('Due 28 Jul');
  });
});
