/**
 * Guards detectTrueSavingsRate's month-to-date window (defect D4). The window
 * must be LOCAL-dated: a UTC-formatted boundary dropped today's transactions and
 * leaked the previous month's last day in positive-offset timezones, producing a
 * wrong net-savings figure.
 */
import { detectTrueSavingsRate, detectDuplicatePayments, detectSubscriptions } from '@/finance/insights';
import type { TxRecord } from '@/finance/db/transactionDb';

function tx(date: string, direction: 'credit' | 'debit', amountPaise: number): TxRecord {
  return {
    id: `tx-${date}-${direction}-${amountPaise}`,
    date,
    amount: amountPaise,
    direction,
    merchant: 'Test',
    category: 'misc',
    source: 'manual',
    rawEmailId: '',
    confidence: 1,
    userCorrected: false,
  };
}

describe('detectTrueSavingsRate — local month-to-date window', () => {
  // Fixed clock: 5 June 2026 (local). Window is 2026-06-01 .. 2026-06-05.
  const NOW = new Date(2026, 5, 5, 12, 0, 0);
  const plan = { monthlyTarget: 1000 }; // rupees

  it('counts only this-month transactions and excludes last month', () => {
    const txns = [
      tx('2026-06-02', 'credit', 200_000), // ₹2000 this month
      tx('2026-06-03', 'debit', 50_000),   // ₹500 this month
      tx('2026-05-31', 'debit', 900_000),  // ₹9000 LAST month — must be excluded
    ];
    const insight = detectTrueSavingsRate(txns, plan, NOW);
    // Net this month = 2000 - 500 = ₹1500 ≥ ₹1000 target → ahead.
    expect(insight?.id).toBe('savings_ahead');
    expect(insight?.amount).toBe(150_000); // paise
  });

  it("includes a transaction dated TODAY (the boundary the UTC bug dropped)", () => {
    const txns = [tx('2026-06-05', 'credit', 120_000)]; // ₹1200 today
    const insight = detectTrueSavingsRate(txns, plan, NOW);
    expect(insight?.id).toBe('savings_ahead');
    expect(insight?.amount).toBe(120_000);
  });

  it('flags behind-target as an alert when the month net is negative', () => {
    const txns = [tx('2026-06-02', 'debit', 300_000)]; // ₹3000 out, nothing in
    const insight = detectTrueSavingsRate(txns, plan, NOW);
    expect(insight?.id).toBe('savings_behind');
    expect(insight?.severity).toBe('alert');
  });

  it('returns null without a plan or with no transactions in-window', () => {
    expect(detectTrueSavingsRate([tx('2026-06-02', 'credit', 1)], null, NOW)).toBeNull();
    expect(detectTrueSavingsRate([tx('2026-04-01', 'credit', 1)], plan, NOW)).toBeNull();
  });
});

// A debit to a named merchant for the subscription/duplicate detectors.
function debit(merchant: string, date: string, amountPaise: number): TxRecord {
  return {
    id: `${merchant}-${date}-${amountPaise}`,
    date,
    amount: amountPaise,
    direction: 'debit',
    merchant,
    category: 'misc',
    source: 'manual',
    rawEmailId: '',
    confidence: 1,
    userCorrected: false,
  };
}

describe('detectDuplicatePayments (D9 — count all duplicates, not just one pair)', () => {
  it('counts EVERY same-day duplicate charge and sums the at-risk amount', () => {
    const txns = [
      debit('Swiggy', '2026-06-10', 50_000),
      debit('Swiggy', '2026-06-10', 50_000),
      debit('Swiggy', '2026-06-10', 50_000), // 3 identical same-day → 2 extra
    ];
    const insight = detectDuplicatePayments(txns);
    expect(insight?.id).toBe('duplicate_payments');
    expect(insight?.amount).toBe(100_000); // 2 extra × ₹500
    expect(insight?.body).toContain('2 possible duplicate charges');
  });

  it('returns null when same-amount charges are more than a day apart', () => {
    const txns = [debit('Swiggy', '2026-06-01', 50_000), debit('Swiggy', '2026-06-20', 50_000)];
    expect(detectDuplicatePayments(txns)).toBeNull();
  });
});

describe('detectSubscriptions (D10 — merchant-keyed, tolerates a price bump)', () => {
  it('detects a monthly subscription across a price change and reports the current price', () => {
    const txns = [
      debit('Netflix', '2026-04-01', 64_900),
      debit('Netflix', '2026-05-01', 64_900),
      debit('Netflix', '2026-06-01', 69_900), // price bump — old amount-keyed code missed this
    ];
    const insight = detectSubscriptions(txns);
    expect(insight?.id).toBe('subscriptions');
    expect(insight?.amount).toBe(69_900); // latest = current price
  });

  it('does NOT flag a merchant with wildly varying monthly spend (groceries)', () => {
    const txns = [
      debit('BigBazaar', '2026-04-01', 120_000),
      debit('BigBazaar', '2026-05-01', 380_000),
      debit('BigBazaar', '2026-06-01', 95_000),
    ];
    expect(detectSubscriptions(txns)).toBeNull();
  });
});
