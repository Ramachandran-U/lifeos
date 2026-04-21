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

class FinanceDb extends Dexie {
  transactions!: Table<TxRecord, string>;

  constructor() {
    super('lifeos_finance');
    this.version(1).stores({
      transactions: 'id, date, direction, category, source, rawEmailId',
    });
  }
}

export const financeDb = new FinanceDb();

export async function upsertTransactions(records: TxRecord[]): Promise<number> {
  if (records.length === 0) return 0;
  const existing = await financeDb.transactions
    .where('rawEmailId')
    .anyOf(records.map((r) => r.rawEmailId))
    .toArray();
  const existingIds = new Set(existing.map((r) => r.rawEmailId));
  const fresh = records.filter((r) => !existingIds.has(r.rawEmailId));
  if (fresh.length > 0) await financeDb.transactions.bulkPut(fresh);
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
  await financeDb.transactions.update(id, { category, userCorrected: true });
}

export async function clearAllTransactions(): Promise<void> {
  await financeDb.transactions.clear();
}
