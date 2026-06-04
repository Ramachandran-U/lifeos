import { buildMoneyReviewInput, type MoneyReviewTx } from '../moneyReview';

const NOW = new Date('2026-05-20');

const tx = (over: Partial<MoneyReviewTx>): MoneyReviewTx => ({
  date: '2026-05-05',
  amount: 100000, // ₹1000
  direction: 'debit',
  merchant: 'Swiggy',
  category: 'food_delivery',
  ...over,
});

describe('buildMoneyReviewInput', () => {
  it('excludes non-consumption from spend and computes net', () => {
    const input = buildMoneyReviewInput(
      [
        tx({ amount: 100000, category: 'groceries' }),
        tx({ amount: 50000, category: 'dining_out' }),
        tx({ amount: 5000000, category: 'transfers' }), // excluded from spend
        tx({ amount: 300000, category: 'income', direction: 'credit' }), // income
      ],
      NOW,
    );
    expect(input.totalSpend).toBe(1500); // 1000 + 500 rupees
    expect(input.income).toBe(3000);
    expect(input.net).toBe(1500);
    expect(input.monthLabel).toBe('May 2026');
  });

  it('computes MoM delta against last month', () => {
    const input = buildMoneyReviewInput(
      [
        tx({ date: '2026-05-05', amount: 200000, category: 'shopping' }), // this month ₹2000
        tx({ date: '2026-04-10', amount: 100000, category: 'shopping' }), // last month ₹1000
      ],
      NOW,
    );
    expect(input.momDeltaPct).toBe(100);
  });

  it('surfaces top categories and merchants, and needs/wants/savings', () => {
    const input = buildMoneyReviewInput(
      [
        tx({ merchant: 'BigBazaar', amount: 300000, category: 'groceries' }), // needs
        tx({ merchant: 'Swiggy', amount: 120000, category: 'food_delivery' }), // wants
        tx({ merchant: 'Zerodha', amount: 500000, category: 'investments' }), // savings
      ],
      NOW,
    );
    expect(input.topCategories[0].category).toBe('groceries');
    expect(input.topMerchants[0].merchant).toBe('BigBazaar');
    expect(input.needsWantsSavings.needs).toBe(3000);
    expect(input.needsWantsSavings.wants).toBe(1200);
    expect(input.needsWantsSavings.savings).toBe(5000);
  });

  it('returns null MoM when there is no last-month data', () => {
    const input = buildMoneyReviewInput([tx({ date: '2026-05-01' })], NOW);
    expect(input.momDeltaPct).toBeNull();
  });

  it('compares against the SAME day-range last month, not the full month', () => {
    // June 4: month-to-date is Jun 1–4. Last month must be measured Jun→May 1–4,
    // NOT the whole of May — otherwise an in-progress month looks like a collapse.
    const input = buildMoneyReviewInput(
      [
        tx({ date: '2026-06-02', amount: 35300, category: 'shopping' }), // MTD: ₹353
        tx({ date: '2026-05-03', amount: 30000, category: 'shopping' }), // last month, within 1–4: ₹300
        tx({ date: '2026-05-20', amount: 500000, category: 'shopping' }), // last month, AFTER the 4th → excluded
      ],
      new Date(2026, 5, 4),
    );
    expect(input.totalSpend).toBe(353);
    // 353 vs 300 (same period) = +18%; the May 20 ₹5000 must NOT pull it to a fake drop.
    expect(input.momDeltaPct).toBe(18);
  });
});
