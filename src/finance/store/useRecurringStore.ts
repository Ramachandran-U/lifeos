import { create } from 'zustand';
import { Platform } from 'react-native';
import {
  getActiveRecurringItems,
  upsertRecurringItems,
  dismissRecurringItem,
  clearRecurringItems,
  type RecurringItemRecord,
} from '@/finance/db/transactionDb';
import { isGmailConnected } from '@/finance/gmail/oauth';
import { syncRecentBillEmails } from '@/finance/gmail/fetcher';
import { parseBillOrSubscription } from '@/finance/parsers/billParsers';

/**
 * Subscription/bill audit store. Mirrors useTransactionStore: web-only (Gmail
 * OAuth is web-only), Dexie-backed, sync via the Worker-proxied Gmail token.
 * Reads the same gmail.readonly scope the transaction sync already uses — no
 * new permission. Detection is pure regex (billParsers) — no AI, no cost.
 */
interface RecurringState {
  items: RecurringItemRecord[];
  gmailConnected: boolean;
  syncing: boolean;
  syncError: string | null;
  lastSyncedAt: string | null;
  ingestedCount: number;

  load: () => Promise<void>;
  refreshConnection: () => void;
  sync: (clientId: string) => Promise<number>;
  dismiss: (id: string) => Promise<void>;
  clear: () => Promise<void>;
}

const LAST_SYNC_KEY = 'lifeos_recurring_last_sync';

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

export const useRecurringStore = create<RecurringState>((set) => ({
  items: [],
  gmailConnected: Platform.OS === 'web' ? isGmailConnected() : false,
  syncing: false,
  syncError: null,
  lastSyncedAt: readLastSync(),
  ingestedCount: 0,

  load: async () => {
    if (Platform.OS !== 'web') {
      set({ items: [] });
      return;
    }
    set({ items: await getActiveRecurringItems() });
  },

  refreshConnection: () => {
    set({ gmailConnected: isGmailConnected() });
  },

  sync: async (clientId: string) => {
    if (Platform.OS !== 'web') {
      set({ syncError: 'Gmail sync is only available on web.' });
      return 0;
    }
    set({ syncing: true, syncError: null, ingestedCount: 0 });
    try {
      const messages = await syncRecentBillEmails(clientId);
      const now = new Date().toISOString();

      const records: RecurringItemRecord[] = [];
      for (const m of messages) {
        const parsed = parseBillOrSubscription(m.from, m.subject, m.body);
        if (!parsed) continue;
        records.push({
          id: m.id,
          kind: parsed.kind,
          merchant: parsed.merchant,
          amount: parsed.amount,
          dueDate: parsed.dueDate ?? null,
          cadence: parsed.cadence ?? null,
          rawEmailId: m.id,
          confidence: parsed.confidence,
          dismissed: false,
          detectedAt: now,
        });
      }

      const inserted = await upsertRecurringItems(records);
      const items = await getActiveRecurringItems();
      writeLastSync(now);
      set({ items, syncing: false, lastSyncedAt: now, ingestedCount: inserted });
      return inserted;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      set({ syncing: false, syncError: message });
      return 0;
    }
  },

  dismiss: async (id: string) => {
    await dismissRecurringItem(id);
    set({ items: await getActiveRecurringItems() });
  },

  clear: async () => {
    await clearRecurringItems();
    set({ items: [], lastSyncedAt: null, ingestedCount: 0 });
  },
}));
