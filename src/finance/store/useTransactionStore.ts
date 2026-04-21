import { create } from 'zustand';
import { Platform } from 'react-native';
import {
  financeDb,
  getAllTransactions,
  upsertTransactions,
  updateTransactionCategory as dbUpdateCategory,
  type TxRecord,
} from '@/finance/db/transactionDb';
import { isGmailConnected, clearGmailTokens } from '@/finance/gmail/oauth';
import { syncRecentEmails } from '@/finance/gmail/fetcher';
import { parseTransactionEmail } from '@/finance/parsers/emailParsers';
import { categorizeBatch } from '@/finance/categorizer';
import type { TransactionCategory } from '@/ai/types';

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
  setCategory: (id: string, category: TransactionCategory) => Promise<void>;
  disconnect: () => Promise<void>;
}

const LAST_SYNC_KEY = 'lifeos_last_sync';

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
    set({ transactions: all });
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
      const messages = await syncRecentEmails(clientId);

      const parsed = messages
        .map((m) => {
          const tx = parseTransactionEmail(m.from, `${m.subject}\n${m.body}`);
          if (!tx) return null;
          return { message: m, tx };
        })
        .filter((x): x is { message: (typeof messages)[number]; tx: NonNullable<ReturnType<typeof parseTransactionEmail>> } => x !== null);

      const skipped = messages.filter((m) => !parseTransactionEmail(m.from, `${m.subject}\n${m.body}`));
      if (skipped.length) {
        console.group(`[finance] ${skipped.length} email(s) failed to parse`);
        skipped.slice(0, 3).forEach((m, i) => {
          console.log(`--- skipped #${i + 1} ---`);
          console.log('from:', m.from);
          console.log('subject:', m.subject);
          console.log('body (first 600 chars):', m.body.slice(0, 600));
        });
        console.groupEnd();
      }

      const categories = await categorizeBatch(
        parsed.map(({ tx }) => ({ merchant: tx.merchant, amount: tx.amount, direction: tx.direction })),
        { maxAiCalls: 5 },
      );

      const records: TxRecord[] = parsed.map(({ message, tx }, i) => ({
        id: message.id,
        date: message.date || new Date().toISOString().slice(0, 10),
        amount: tx.amount,
        direction: tx.direction,
        merchant: tx.merchant,
        category: categories[i] ?? 'other',
        source: tx.source,
        rawEmailId: message.id,
        confidence: tx.confidence,
        userCorrected: false,
      }));

      const inserted = await upsertTransactions(records);
      const all = await getAllTransactions();
      const now = new Date().toISOString();
      writeLastSync(now);
      set({
        transactions: all,
        lastSyncedAt: now,
        syncing: false,
        ingestedCount: inserted,
        skippedCount: messages.length - parsed.length,
      });
      return inserted;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      set({ syncing: false, syncError: message });
      return 0;
    }
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
