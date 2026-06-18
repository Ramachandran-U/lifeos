import { create } from 'zustand';
import { Platform } from 'react-native';
import {
  financeDb,
  getAllTransactions,
  addManualTransaction,
  updateTransactionCategory as dbUpdateCategory,
  type TxRecord,
  type TxDirection,
} from '@/finance/db/transactionDb';
import { isGmailConnected, clearGmailTokens } from '@/finance/gmail/oauth';
import { syncFinanceFromGmail } from '@/finance/gmail/sync';
import { normalizeUpiMerchant } from '@/finance/parsers/emailParsers';
import { categorizeByRule } from '@/finance/categorizer';
import { nanoid } from '@/utils/id';
import type { TransactionCategory } from '@/ai/types';

/** A user-entered transaction (the manual-add path, web-only). Amount is in
 *  whole rupees as typed; the store converts to the paise the table stores. */
export interface ManualTxInput {
  amountRupees: number;
  direction: TxDirection;
  merchant: string;
  category: TransactionCategory;
  /** YYYY-MM-DD; defaults to today. */
  date?: string;
}

interface TransactionState {
  transactions: TxRecord[];
  gmailConnected: boolean;
  lastSyncedAt: string | null;
  syncing: boolean;
  syncError: string | null;
  ingestedCount: number;
  skippedCount: number;

  load: () => Promise<void>;
  refreshConnection: () => void;
  sync: (clientId: string) => Promise<number>;
  addManual: (input: ManualTxInput) => Promise<boolean>;
  setCategory: (id: string, category: TransactionCategory) => Promise<void>;
  disconnect: () => Promise<void>;
}

const LAST_SYNC_KEY = 'lifeos_last_sync';
const UPI_MIGRATION_KEY = 'lifeos_upi_migration_v1';

/**
 * Legacy transactions stored `UPI/P2A/<refId>/NAME` as the merchant, making
 * every row look unique. This one-time pass rewrites them to the clean name
 * and downgrades P2A rows from `other` → `transfers`.
 */
async function migrateLegacyUpiMerchants(records: TxRecord[]): Promise<TxRecord[]> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return records;
  try {
    if (localStorage.getItem(UPI_MIGRATION_KEY)) return records;
  } catch {
    return records;
  }

  const needsFix = records.filter((r) => !r.userCorrected && /^UPI\/P2[AM]\//i.test(r.merchant));
  if (needsFix.length === 0) {
    try { localStorage.setItem(UPI_MIGRATION_KEY, '1'); } catch {}
    return records;
  }

  const updates: TxRecord[] = needsFix.map((r) => {
    const { merchant, channel } = normalizeUpiMerchant(r.merchant);
    let category = r.category;
    if (r.category === 'other') {
      if (channel === 'p2a') category = 'transfers';
      else {
        const rule = categorizeByRule(merchant);
        if (rule) category = rule;
      }
    }
    return { ...r, merchant, category };
  });

  await financeDb.transactions.bulkPut(updates);
  try { localStorage.setItem(UPI_MIGRATION_KEY, '1'); } catch {}
  return getAllTransactions();
}


function readLastSync(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

function writeLastSync(iso: string): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAST_SYNC_KEY, iso);
  } catch {
    // ignore
  }
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  gmailConnected: Platform.OS === 'web' ? isGmailConnected() : false,
  lastSyncedAt: readLastSync(),
  syncing: false,
  syncError: null,
  ingestedCount: 0,
  skippedCount: 0,

  load: async () => {
    if (Platform.OS !== 'web') {
      set({ transactions: [] });
      return;
    }
    const all = await getAllTransactions();
    const migrated = await migrateLegacyUpiMerchants(all);
    set({ transactions: migrated });
  },

  refreshConnection: () => {
    set({ gmailConnected: isGmailConnected() });
  },

  sync: async (clientId: string) => {
    if (Platform.OS !== 'web') {
      set({ syncError: 'Gmail sync is only available on web.' });
      return 0;
    }
    set({ syncing: true, syncError: null, ingestedCount: 0, skippedCount: 0 });
    try {
      // The fetch→parse→categorize→upsert pipeline lives in syncFinanceFromGmail
      // (the single source of truth, shared with the voice agent's syncFinance
      // tool). The store owns only the UI state around it.
      const result = await syncFinanceFromGmail(clientId);
      const all = await getAllTransactions();
      const now = new Date().toISOString();
      writeLastSync(now);
      set({
        transactions: all,
        lastSyncedAt: now,
        syncing: false,
        ingestedCount: result.ingested,
        skippedCount: result.skipped,
      });
      return result.ingested;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      set({ syncing: false, syncError: message });
      return 0;
    }
  },

  addManual: async (input) => {
    if (Platform.OS !== 'web') {
      set({ syncError: 'Manual entry is only available on web.' });
      return false;
    }
    const amountPaise = Math.round(input.amountRupees * 100);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      set({ syncError: 'Enter an amount greater than zero.' });
      return false;
    }
    // A unique id doubles as rawEmailId so a manual row can never collide with a
    // synced bank-email row (upsertTransactions dedups on rawEmailId).
    const id = `manual-${nanoid()}`;
    const rec: TxRecord = {
      id,
      date: input.date || new Date().toISOString().slice(0, 10),
      amount: amountPaise,
      direction: input.direction,
      merchant: input.merchant.trim() || 'Manual entry',
      category: input.category,
      source: 'manual',
      rawEmailId: id,
      confidence: 1,
      userCorrected: true,
    };
    await addManualTransaction(rec);
    const all = await getAllTransactions();
    set({ transactions: all, syncError: null });
    return true;
  },

  setCategory: async (id, category) => {
    await dbUpdateCategory(id, category);
    const all = await getAllTransactions();
    set({ transactions: all });
  },

  disconnect: async () => {
    clearGmailTokens();
    await financeDb.transactions.clear();
    set({
      gmailConnected: false,
      transactions: [],
      lastSyncedAt: null,
      ingestedCount: 0,
      skippedCount: 0,
    });
  },
}));
