import Dexie, { type Table } from 'dexie';

export type TxDirection = 'debit' | 'credit';
export type TxSource = 'hdfc' | 'icici' | 'axis' | 'manual';

export interface TxRecord {
  id: string;
  date: string;
  amount: number;
  direction: TxDirection;
  merchant: string;
  category: string;
  source: TxSource;
  rawEmailId: string;
  confidence: number;
  userCorrected: boolean;
}

/**
 * Merchant → category memo cache. Avoids re-categorizing the same merchant
 * via the AI on every sync. Keyed by `merchantKey` (normalized merchant
 * string from normalizeMerchantForCache in categorizer.ts).
 *
 * `source`:
 *  - 'rule' = matched the static rule map
 *  - 'ai'   = AI batch categorization
 *  - 'user' = user manually re-categorized; never overwritten by 'rule'/'ai'
 */
export interface MerchantCacheRecord {
  merchantKey: string;
  category: string;
  confidence: number;
  source: 'rule' | 'ai' | 'user';
  updatedAt: number;
}

class FinanceDb extends Dexie {
  transactions!: Table<TxRecord, string>;
  merchantCache!: Table<MerchantCacheRecord, string>;

  constructor() {
    super('lifeos_finance');
    this.version(1).stores({
      transactions: 'id, date, direction, category, source, rawEmailId',
    });
    this.version(2).stores({
      transactions: 'id, date, direction, category, source, rawEmailId',
      merchantCache: 'merchantKey, category, source, updatedAt',
    });
  }
}

export const financeDb = new FinanceDb();

export async function getCachedCategories(
  merchantKeys: string[],
): Promise<Map<string, MerchantCacheRecord>> {
  if (merchantKeys.length === 0) return new Map();
  const rows = await financeDb.merchantCache.where('merchantKey').anyOf(merchantKeys).toArray();
  return new Map(rows.map((r) => [r.merchantKey, r]));
}

export async function setCachedCategory(record: MerchantCacheRecord): Promise<void> {
  // Don't let an automated source ('rule'/'ai') overwrite a user correction.
  const existing = await financeDb.merchantCache.get(record.merchantKey);
  if (existing?.source === 'user' && record.source !== 'user') return;
  await financeDb.merchantCache.put(record);
}

export async function setCachedCategoriesBulk(records: MerchantCacheRecord[]): Promise<void> {
  if (records.length === 0) return;
  const keys = records.map((r) => r.merchantKey);
  const existing = await financeDb.merchantCache.where('merchantKey').anyOf(keys).toArray();
  const userLocked = new Set(
    existing.filter((r) => r.source === 'user').map((r) => r.merchantKey),
  );
  const safe = records.filter((r) => !userLocked.has(r.merchantKey) || r.source === 'user');
  if (safe.length > 0) await financeDb.merchantCache.bulkPut(safe);
}

export async function upsertTransactions(records: TxRecord[]): Promise<number> {
  if (records.length === 0) return 0;
  const existing = await financeDb.transactions
    .where('rawEmailId')
    .anyOf(records.map((r) => r.rawEmailId))
    .toArray();
  const existingByEmail = new Map(existing.map((r) => [r.rawEmailId, r]));
  const fresh = records.filter((r) => !existingByEmail.has(r.rawEmailId));

  // Re-categorisation on re-sync: the first sync may have left rows as 'other'
  // (the per-sync AI cap was hit, or the merchant cache was cold). A later sync
  // resolves more merchants, so upgrade any existing 'other' row whose merchant
  // now has a real category — but never touch a user's manual correction.
  const upgrades = records
    .map((r) => {
      const ex = existingByEmail.get(r.rawEmailId);
      if (ex && !ex.userCorrected && ex.category === 'other' && r.category !== 'other') {
        return { ...ex, category: r.category };
      }
      return null;
    })
    .filter((r): r is TxRecord => r !== null);

  if (fresh.length > 0) await financeDb.transactions.bulkPut(fresh);
  if (upgrades.length > 0) await financeDb.transactions.bulkPut(upgrades);
  return fresh.length;
}

export async function getAllTransactions(): Promise<TxRecord[]> {
  return financeDb.transactions.orderBy('date').reverse().toArray();
}

export async function getTransactionsInRange(
  startDate: string,
  endDate: string,
): Promise<TxRecord[]> {
  return financeDb.transactions
    .where('date')
    .between(startDate, endDate, true, true)
    .reverse()
    .sortBy('date');
}

export async function updateTransactionCategory(
  id: string,
  category: string,
): Promise<void> {
  const tx = await financeDb.transactions.get(id);
  await financeDb.transactions.update(id, { category, userCorrected: true });

  // Propagate the correction to the merchant cache as a 'user' source row
  // so future syncs (and other transactions from the same merchant) inherit
  // the user's preference instead of re-asking the AI.
  if (tx) {
    // Local import to avoid a circular dependency at module load time —
    // categorizer.ts imports from this file too.
    const { normalizeMerchantForCache } = await import('@/finance/categorizer');
    await setCachedCategory({
      merchantKey: normalizeMerchantForCache(tx.merchant),
      category,
      confidence: 1,
      source: 'user',
      updatedAt: Date.now(),
    });
  }
}

export async function clearAllTransactions(): Promise<void> {
  await financeDb.transactions.clear();
}
