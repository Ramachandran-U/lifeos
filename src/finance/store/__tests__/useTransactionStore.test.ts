// fake-indexeddb backs the Dexie finance store under the node test env. MUST
// precede the store import (financeDb opens at module load).
import 'fake-indexeddb/auto';

// Force the web branch (the store guards every Dexie path on Platform.OS).
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
// Keep the store's module-load side effects hermetic: the initial state calls
// isGmailConnected(); the sync path is mocked away (not under test here).
jest.mock('@/finance/gmail/oauth', () => ({
  isGmailConnected: () => false,
  clearGmailTokens: () => {},
}));
jest.mock('@/finance/gmail/sync', () => ({ syncFinanceFromGmail: jest.fn() }));
// Deterministic id so the manual row's id/rawEmailId are assertable.
jest.mock('@/utils/id', () => ({ nanoid: () => 'fixed1' }));

import { useTransactionStore } from '@/finance/store/useTransactionStore';
import { financeDb } from '@/finance/db/transactionDb';

beforeEach(async () => {
  await financeDb.transactions.clear();
  useTransactionStore.setState({ transactions: [], syncError: null });
});

afterAll(() => {
  financeDb.close();
});

describe('useTransactionStore.addManual', () => {
  it('persists a manual row, converting rupees → paise, and updates store state', async () => {
    const ok = await useTransactionStore.getState().addManual({
      amountRupees: 250,
      direction: 'debit',
      merchant: 'Chai stall',
      category: 'food_delivery',
    });

    expect(ok).toBe(true);
    const row = await financeDb.transactions.get('manual-fixed1');
    expect(row).toMatchObject({
      amount: 25000, // 250 rupees → paise
      direction: 'debit',
      merchant: 'Chai stall',
      category: 'food_delivery',
      source: 'manual',
      rawEmailId: 'manual-fixed1',
      userCorrected: true,
    });
    // store state reflects the new row
    expect(useTransactionStore.getState().transactions.map((t) => t.id)).toEqual(['manual-fixed1']);
  });

  it('defaults a blank merchant to "Manual entry" and the date to today', async () => {
    await useTransactionStore.getState().addManual({
      amountRupees: 10,
      direction: 'credit',
      merchant: '   ',
      category: 'other',
    });

    const row = await financeDb.transactions.get('manual-fixed1');
    expect(row?.merchant).toBe('Manual entry');
    expect(row?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('rejects a non-positive amount: no row written, returns false, sets syncError', async () => {
    const ok = await useTransactionStore.getState().addManual({
      amountRupees: 0,
      direction: 'debit',
      merchant: 'Nope',
      category: 'other',
    });

    expect(ok).toBe(false);
    expect(await financeDb.transactions.count()).toBe(0);
    expect(useTransactionStore.getState().syncError).toMatch(/greater than zero/i);
  });
});
