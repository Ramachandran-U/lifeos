// fake-indexeddb gives Dexie a real (in-memory) IndexedDB so the Dexie-backed
// finance store runs under the node test env. MUST come before the module under
// test is imported, because `financeDb = new FinanceDb()` opens at load.
import 'fake-indexeddb/auto';

// Stub the read-tool set so this spec stays hermetic to the finance tool: the
// real buildLifeOsTools pulls in the app DB / query chain we don't need here.
// buildVoiceTools just composes [...readTools, recentSpendingTool], so an empty
// read set lets us exercise getRecentSpending in isolation.
jest.mock('@/ai/agent/tools', () => ({ buildLifeOsTools: () => [] }));

import { financeDb, upsertTransactions, type TxRecord } from '@/finance/db/transactionDb';
import { buildVoiceTools } from '@/ai/agent/voiceTools';

function makeTx(overrides: Partial<TxRecord> = {}): TxRecord {
  return {
    id: 'tx-1',
    date: '2026-05-20',
    amount: 10000, // paise
    direction: 'debit',
    merchant: 'Test Merchant',
    category: 'other',
    source: 'manual',
    rawEmailId: 'email-1',
    confidence: 0.5,
    userCorrected: false,
    ...overrides,
  };
}

const TODAY = '2026-05-31';
function spendingTool() {
  const tool = buildVoiceTools({ userId: 'u1', today: TODAY }).find(
    (t) => t.declaration.name === 'getRecentSpending',
  );
  if (!tool) throw new Error('getRecentSpending tool not found');
  return tool;
}

beforeEach(async () => {
  await financeDb.transactions.clear();
});

afterAll(() => {
  financeDb.close();
});

describe('buildVoiceTools', () => {
  it('exposes the getRecentSpending tool', () => {
    const names = buildVoiceTools({ userId: 'u1', today: TODAY }).map((t) => t.declaration.name);
    expect(names).toContain('getRecentSpending');
  });
});

describe('getRecentSpending', () => {
  it('summarises in-window debits by category and merchant, in rupees', async () => {
    await upsertTransactions([
      makeTx({ id: 'a', rawEmailId: 'e-a', date: '2026-05-20', amount: 50000, merchant: 'Swiggy', category: 'food_delivery' }),
      makeTx({ id: 'b', rawEmailId: 'e-b', date: '2026-05-21', amount: 30000, merchant: 'Swiggy', category: 'food_delivery' }),
      makeTx({ id: 'c', rawEmailId: 'e-c', date: '2026-05-22', amount: 20000, merchant: 'Uber', category: 'transport' }),
      // a credit (income) — must be excluded from "spending"
      makeTx({ id: 'inc', rawEmailId: 'e-inc', date: '2026-05-22', amount: 999999, direction: 'credit', merchant: 'Salary', category: 'income' }),
      // a debit outside the 30-day window — must be excluded
      makeTx({ id: 'old', rawEmailId: 'e-old', date: '2026-01-01', amount: 70000, merchant: 'OldShop', category: 'shopping' }),
    ]);

    const result = (await spendingTool().execute({ days: 30 })) as {
      currency: string;
      totalSpentRupees: number;
      byCategory: Array<{ category: string; amountRupees: number; pct: number }>;
      topMerchants: Array<{ merchant: string; amountRupees: number; count: number }>;
    };

    // (50000 + 30000 + 20000) paise = 100000 paise = ₹1000. Credit + old debit excluded.
    expect(result.currency).toBe('INR');
    expect(result.totalSpentRupees).toBe(1000);
    expect(result.byCategory[0]).toEqual({ category: 'food_delivery', amountRupees: 800, pct: 80 });
    expect(result.byCategory.find((c) => c.category === 'transport')).toEqual({
      category: 'transport',
      amountRupees: 200,
      pct: 20,
    });
    expect(result.topMerchants[0]).toEqual({ merchant: 'Swiggy', amountRupees: 800, count: 2 });
  });

  it('returns a zero summary with a sync hint when the window is empty', async () => {
    const result = (await spendingTool().execute({})) as {
      totalSpentRupees: number;
      byCategory: unknown[];
      topMerchants: unknown[];
      note?: string;
    };

    expect(result.totalSpentRupees).toBe(0);
    expect(result.byCategory).toEqual([]);
    expect(result.topMerchants).toEqual([]);
    expect(result.note).toMatch(/sync/i);
  });
});
