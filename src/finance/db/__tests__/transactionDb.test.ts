// fake-indexeddb gives Dexie a real (in-memory) IndexedDB so the Dexie-backed
// transaction store runs under the node test env. MUST come before the module
// under test is imported, because `financeDb = new FinanceDb()` opens at load.
import 'fake-indexeddb/auto';

// `updateTransactionCategory` does a dynamic `import('@/finance/categorizer')`
// to reach `normalizeMerchantForCache`. The real categorizer pulls in the AI
// function chain; stub it down to the one pure helper we actually need so this
// spec stays hermetic to the DB layer.
jest.mock('@/finance/categorizer', () => ({
  normalizeMerchantForCache: (merchant: string): string =>
    merchant.toLowerCase().replace(/\s+/g, ' ').trim(),
}));

import {
  financeDb,
  getCachedCategories,
  setCachedCategory,
  setCachedCategoriesBulk,
  upsertTransactions,
  getAllTransactions,
  getTransactionsInRange,
  updateTransactionCategory,
  clearAllTransactions,
  type TxRecord,
  type MerchantCacheRecord,
} from '@/finance/db/transactionDb';

function makeTx(overrides: Partial<TxRecord> = {}): TxRecord {
  return {
    id: 'tx-1',
    date: '2026-05-01',
    amount: 100,
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

function makeCache(overrides: Partial<MerchantCacheRecord> = {}): MerchantCacheRecord {
  return {
    merchantKey: 'test merchant',
    category: 'other',
    confidence: 0.5,
    source: 'rule',
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

beforeEach(async () => {
  await financeDb.transactions.clear();
  await financeDb.merchantCache.clear();
});

afterAll(() => {
  financeDb.close();
});

describe('upsertTransactions', () => {
  it('inserts fresh rows and returns the inserted count', async () => {
    const inserted = await upsertTransactions([
      makeTx({ id: 'a', rawEmailId: 'e-a', date: '2026-05-01' }),
      makeTx({ id: 'b', rawEmailId: 'e-b', date: '2026-05-02' }),
    ]);

    expect(inserted).toBe(2);
    expect(await financeDb.transactions.count()).toBe(2);
  });

  it('returns 0 for an empty batch and writes nothing', async () => {
    const inserted = await upsertTransactions([]);
    expect(inserted).toBe(0);
    expect(await financeDb.transactions.count()).toBe(0);
  });

  it('dedups by rawEmailId — a row already present is not re-inserted', async () => {
    await upsertTransactions([makeTx({ id: 'a', rawEmailId: 'dup', category: 'food_delivery' })]);

    const inserted = await upsertTransactions([
      makeTx({ id: 'a', rawEmailId: 'dup', category: 'food_delivery' }),
    ]);

    expect(inserted).toBe(0);
    expect(await financeDb.transactions.count()).toBe(1);
  });

  it("upgrades an existing 'other' row to a real category on re-sync", async () => {
    await upsertTransactions([makeTx({ id: 'a', rawEmailId: 'e-a', category: 'other' })]);

    // re-sync resolves the merchant to a real category
    const inserted = await upsertTransactions([
      makeTx({ id: 'a', rawEmailId: 'e-a', category: 'food_delivery' }),
    ]);

    expect(inserted).toBe(0); // not a fresh insert, it's an upgrade
    const row = await financeDb.transactions.get('a');
    expect(row?.category).toBe('food_delivery');
  });

  it("never upgrades a row whose category is already a real category", async () => {
    await upsertTransactions([makeTx({ id: 'a', rawEmailId: 'e-a', category: 'groceries' })]);

    await upsertTransactions([
      makeTx({ id: 'a', rawEmailId: 'e-a', category: 'food_delivery' }),
    ]);

    const row = await financeDb.transactions.get('a');
    expect(row?.category).toBe('groceries');
  });

  it("never overwrites a userCorrected category, even when upgrading from 'other'", async () => {
    await upsertTransactions([
      makeTx({ id: 'a', rawEmailId: 'e-a', category: 'other', userCorrected: true }),
    ]);

    await upsertTransactions([
      makeTx({ id: 'a', rawEmailId: 'e-a', category: 'food_delivery' }),
    ]);

    const row = await financeDb.transactions.get('a');
    expect(row?.category).toBe('other');
    expect(row?.userCorrected).toBe(true);
  });

  it('does not upgrade when the incoming category is also "other"', async () => {
    await upsertTransactions([makeTx({ id: 'a', rawEmailId: 'e-a', category: 'other' })]);

    await upsertTransactions([makeTx({ id: 'a', rawEmailId: 'e-a', category: 'other' })]);

    const row = await financeDb.transactions.get('a');
    expect(row?.category).toBe('other');
  });

  it('inserts the fresh rows and upgrades existing ones in a single mixed batch', async () => {
    await upsertTransactions([makeTx({ id: 'a', rawEmailId: 'e-a', category: 'other' })]);

    const inserted = await upsertTransactions([
      makeTx({ id: 'a', rawEmailId: 'e-a', category: 'transport' }), // upgrade
      makeTx({ id: 'b', rawEmailId: 'e-b', category: 'groceries' }), // fresh
    ]);

    expect(inserted).toBe(1);
    expect((await financeDb.transactions.get('a'))?.category).toBe('transport');
    expect((await financeDb.transactions.get('b'))?.category).toBe('groceries');
  });
});

describe('setCachedCategory / getCachedCategories', () => {
  it('writes a cache row and reads it back keyed by merchantKey', async () => {
    await setCachedCategory(makeCache({ merchantKey: 'swiggy', category: 'food_delivery' }));

    const map = await getCachedCategories(['swiggy']);
    expect(map.get('swiggy')?.category).toBe('food_delivery');
  });

  it('returns an empty map for an empty key list (no query)', async () => {
    const map = await getCachedCategories([]);
    expect(map.size).toBe(0);
  });

  it('returns only the keys that exist', async () => {
    await setCachedCategory(makeCache({ merchantKey: 'swiggy', category: 'food_delivery' }));

    const map = await getCachedCategories(['swiggy', 'unknown-merchant']);
    expect(map.size).toBe(1);
    expect(map.has('swiggy')).toBe(true);
    expect(map.has('unknown-merchant')).toBe(false);
  });

  it("an automated source ('rule'/'ai') must not overwrite a 'user' cache row", async () => {
    await setCachedCategory(
      makeCache({ merchantKey: 'zomato', category: 'food_delivery', source: 'user' }),
    );

    await setCachedCategory(
      makeCache({ merchantKey: 'zomato', category: 'groceries', source: 'ai' }),
    );

    const map = await getCachedCategories(['zomato']);
    expect(map.get('zomato')?.category).toBe('food_delivery');
    expect(map.get('zomato')?.source).toBe('user');
  });

  it("a 'user' source may overwrite an existing 'user' row", async () => {
    await setCachedCategory(
      makeCache({ merchantKey: 'zomato', category: 'food_delivery', source: 'user' }),
    );

    await setCachedCategory(
      makeCache({ merchantKey: 'zomato', category: 'dining_out', source: 'user' }),
    );

    const map = await getCachedCategories(['zomato']);
    expect(map.get('zomato')?.category).toBe('dining_out');
  });

  it("an automated source may overwrite a non-user ('rule') row", async () => {
    await setCachedCategory(
      makeCache({ merchantKey: 'uber', category: 'other', source: 'rule' }),
    );

    await setCachedCategory(
      makeCache({ merchantKey: 'uber', category: 'transport', source: 'ai' }),
    );

    const map = await getCachedCategories(['uber']);
    expect(map.get('uber')?.category).toBe('transport');
    expect(map.get('uber')?.source).toBe('ai');
  });
});

describe('setCachedCategoriesBulk', () => {
  it('writes nothing for an empty array', async () => {
    await setCachedCategoriesBulk([]);
    expect(await financeDb.merchantCache.count()).toBe(0);
  });

  it('bulk-writes multiple cache rows', async () => {
    await setCachedCategoriesBulk([
      makeCache({ merchantKey: 'a', category: 'transport' }),
      makeCache({ merchantKey: 'b', category: 'groceries' }),
    ]);

    const map = await getCachedCategories(['a', 'b']);
    expect(map.get('a')?.category).toBe('transport');
    expect(map.get('b')?.category).toBe('groceries');
  });

  it("skips automated rows that would overwrite an existing 'user' row, but still writes the rest", async () => {
    await setCachedCategory(
      makeCache({ merchantKey: 'locked', category: 'food_delivery', source: 'user' }),
    );

    await setCachedCategoriesBulk([
      makeCache({ merchantKey: 'locked', category: 'groceries', source: 'ai' }), // blocked
      makeCache({ merchantKey: 'fresh', category: 'transport', source: 'ai' }), // written
    ]);

    const map = await getCachedCategories(['locked', 'fresh']);
    expect(map.get('locked')?.category).toBe('food_delivery'); // unchanged
    expect(map.get('locked')?.source).toBe('user');
    expect(map.get('fresh')?.category).toBe('transport');
  });

  it("allows a 'user' row in the bulk batch to overwrite an existing 'user' row", async () => {
    await setCachedCategory(
      makeCache({ merchantKey: 'locked', category: 'food_delivery', source: 'user' }),
    );

    await setCachedCategoriesBulk([
      makeCache({ merchantKey: 'locked', category: 'dining_out', source: 'user' }),
    ]);

    const map = await getCachedCategories(['locked']);
    expect(map.get('locked')?.category).toBe('dining_out');
  });
});

describe('getAllTransactions / getTransactionsInRange', () => {
  it('returns all rows newest-first by date', async () => {
    await upsertTransactions([
      makeTx({ id: 'old', rawEmailId: 'e-old', date: '2026-05-01' }),
      makeTx({ id: 'new', rawEmailId: 'e-new', date: '2026-05-10' }),
      makeTx({ id: 'mid', rawEmailId: 'e-mid', date: '2026-05-05' }),
    ]);

    const rows = await getAllTransactions();
    expect(rows.map((r) => r.id)).toEqual(['new', 'mid', 'old']);
  });

  it('returns an empty array when there are no rows', async () => {
    expect(await getAllTransactions()).toEqual([]);
  });

  it('returns only rows inside the inclusive date range, newest-first', async () => {
    await upsertTransactions([
      makeTx({ id: 'before', rawEmailId: 'e1', date: '2026-04-30' }),
      makeTx({ id: 'start', rawEmailId: 'e2', date: '2026-05-01' }),
      makeTx({ id: 'mid', rawEmailId: 'e3', date: '2026-05-15' }),
      makeTx({ id: 'end', rawEmailId: 'e4', date: '2026-05-31' }),
      makeTx({ id: 'after', rawEmailId: 'e5', date: '2026-06-01' }),
    ]);

    const rows = await getTransactionsInRange('2026-05-01', '2026-05-31');
    expect(rows.map((r) => r.id)).toEqual(['end', 'mid', 'start']);
  });
});

describe('updateTransactionCategory', () => {
  it('sets the category and marks the row userCorrected', async () => {
    await upsertTransactions([
      makeTx({ id: 'a', rawEmailId: 'e-a', merchant: 'Swiggy', category: 'other' }),
    ]);

    await updateTransactionCategory('a', 'food_delivery');

    const row = await financeDb.transactions.get('a');
    expect(row?.category).toBe('food_delivery');
    expect(row?.userCorrected).toBe(true);
  });

  it("propagates the correction to the merchant cache as a 'user' source row", async () => {
    await upsertTransactions([
      makeTx({ id: 'a', rawEmailId: 'e-a', merchant: 'Swiggy', category: 'other' }),
    ]);

    await updateTransactionCategory('a', 'food_delivery');

    // mocked normalizeMerchantForCache lowercases → 'swiggy'
    const map = await getCachedCategories(['swiggy']);
    const cached = map.get('swiggy');
    expect(cached?.source).toBe('user');
    expect(cached?.category).toBe('food_delivery');
    expect(cached?.confidence).toBe(1);
  });

  it('does not write a cache row when the transaction id is unknown', async () => {
    await updateTransactionCategory('does-not-exist', 'food_delivery');
    expect(await financeDb.merchantCache.count()).toBe(0);
  });
});

describe('clearAllTransactions', () => {
  it('empties the transactions table but leaves the merchant cache intact', async () => {
    await upsertTransactions([makeTx({ id: 'a', rawEmailId: 'e-a' })]);
    await setCachedCategory(makeCache({ merchantKey: 'swiggy', category: 'food_delivery' }));

    await clearAllTransactions();

    expect(await financeDb.transactions.count()).toBe(0);
    expect(await financeDb.merchantCache.count()).toBe(1);
  });
});
