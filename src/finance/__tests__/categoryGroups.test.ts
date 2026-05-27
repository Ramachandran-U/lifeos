import {
  CATEGORY_GROUP,
  CATEGORY_AXIS,
  isConsumptionSpend,
  totalConsumptionSpend,
  spendByGroup,
  spendByAxis,
  type MinimalTx,
} from '../categoryGroups';
import { TRANSACTION_CATEGORIES } from '@/ai/types';

const tx = (over: Partial<MinimalTx>): MinimalTx => ({
  amount: 1000,
  direction: 'debit',
  category: 'shopping',
  ...over,
});

describe('taxonomy completeness', () => {
  it('maps every category to a group and an axis', () => {
    for (const cat of TRANSACTION_CATEGORIES) {
      expect(CATEGORY_GROUP[cat]).toBeDefined();
      expect(CATEGORY_AXIS[cat]).toBeDefined();
    }
  });
});

describe('isConsumptionSpend', () => {
  it('counts ordinary debits', () => {
    expect(isConsumptionSpend('groceries', 'debit')).toBe(true);
    expect(isConsumptionSpend('dining_out', 'debit')).toBe(true);
  });
  it('excludes self-transfers, investments and debt repayment', () => {
    expect(isConsumptionSpend('transfers', 'debit')).toBe(false);
    expect(isConsumptionSpend('investments', 'debit')).toBe(false);
    expect(isConsumptionSpend('debt_repayment', 'debit')).toBe(false);
  });
  it('never counts credits', () => {
    expect(isConsumptionSpend('groceries', 'credit')).toBe(false);
    expect(isConsumptionSpend('income', 'credit')).toBe(false);
  });
});

describe('totalConsumptionSpend', () => {
  it('sums only consumption debits', () => {
    const txns: MinimalTx[] = [
      tx({ amount: 500, category: 'groceries' }),
      tx({ amount: 300, category: 'dining_out' }),
      tx({ amount: 50000, category: 'transfers' }), // excluded
      tx({ amount: 20000, category: 'investments' }), // excluded
      tx({ amount: 1000, category: 'income', direction: 'credit' }), // excluded
    ];
    expect(totalConsumptionSpend(txns)).toBe(800);
  });
});

describe('spendByGroup', () => {
  it('groups and sorts descending, excluding non-consumption', () => {
    const txns: MinimalTx[] = [
      tx({ amount: 1000, category: 'rent' }), // essentials
      tx({ amount: 400, category: 'groceries' }), // essentials
      tx({ amount: 900, category: 'shopping' }), // lifestyle
      tx({ amount: 99999, category: 'transfers' }), // excluded
    ];
    const out = spendByGroup(txns);
    expect(out[0]).toEqual({ group: 'essentials', amount: 1400 });
    expect(out[1]).toEqual({ group: 'lifestyle', amount: 900 });
    expect(out.find((g) => g.group === 'transfers')).toBeUndefined();
  });
});

describe('spendByAxis', () => {
  it('splits needs / wants / savings', () => {
    const txns: MinimalTx[] = [
      tx({ amount: 1000, category: 'rent' }), // needs
      tx({ amount: 500, category: 'shopping' }), // wants
      tx({ amount: 2000, category: 'investments' }), // savings
      tx({ amount: 9999, category: 'transfers' }), // excluded
    ];
    expect(spendByAxis(txns)).toEqual({ needs: 1000, wants: 500, savings: 2000 });
  });
});
