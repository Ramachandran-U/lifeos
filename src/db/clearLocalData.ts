/**
 * Erase ALL on-device user data.
 *
 * Used by sign-out (src/utils/signOut.ts). The per-entity health/finance/contact
 * stores are device-GLOBAL (not user-scoped — see src/db/webStorage/users.ts), so
 * a plain session clear left them readable: the next account on a shared device
 * inherited the previous user's weight history, food log, blood reports and
 * transactions. This wipes everything the app persists locally.
 *
 * - Web: sweep every `lifeos_*` localStorage entry — both the per-entity stores
 *   (src/db/webStorage/_keys.ts) AND the persisted zustand stores (flags,
 *   preferences, domain history, quests, xp history, fit sync, …). Prefix-sweeping
 *   (rather than a hand-maintained list) means a newly-added store can never be
 *   silently forgotten here. Finance lives in Dexie/IndexedDB, cleared separately.
 * - Native: empty every SQLite table.
 *
 * The Supabase auth token (`sb-*-auth-token`) is cleared by supabaseSignOut(), not
 * here — that key is not `lifeos_`-prefixed by design.
 */
import { Platform } from 'react-native';
import { clearAllTransactions } from '@/finance/db/transactionDb';
import { clearAllNativeTables } from './index';

export async function clearAllLocalData(): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('lifeos_')) keys.push(k);
      }
      for (const k of keys) localStorage.removeItem(k);
    } catch {
      /* localStorage unavailable — nothing persisted to clear */
    }
    // Finance transactions are in Dexie/IndexedDB, not localStorage.
    try {
      await clearAllTransactions();
    } catch {
      /* Dexie may not have been opened this session — nothing to clear */
    }
    return;
  }

  await clearAllNativeTables();
}
