/**
 * Guards the sign-out data-wipe (defect C1). The per-entity health/finance stores
 * are device-GLOBAL, so signing out must erase them — not just the session.
 */
import { Platform } from 'react-native';

jest.mock('@/finance/db/transactionDb', () => ({
  clearAllTransactions: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/db/index', () => ({
  clearAllNativeTables: jest.fn().mockResolvedValue(undefined),
}));

import { clearAllLocalData } from '@/db/clearLocalData';
import { clearAllTransactions } from '@/finance/db/transactionDb';
import { clearAllNativeTables } from '@/db/index';

interface LocalStorageStub {
  readonly length: number;
  key(i: number): string | null;
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function installLocalStorage(): LocalStorageStub {
  const map = new Map<string, string>();
  const ls: LocalStorageStub = {
    get length() { return map.size; },
    key: (i) => Array.from(map.keys())[i] ?? null,
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
  (globalThis as unknown as { localStorage?: LocalStorageStub }).localStorage = ls;
  return ls;
}

function uninstallLocalStorage() {
  delete (globalThis as unknown as { localStorage?: LocalStorageStub }).localStorage;
}

describe('clearAllLocalData', () => {
  afterEach(() => {
    jest.clearAllMocks();
    uninstallLocalStorage();
  });

  describe('web', () => {
    let ls: LocalStorageStub;
    beforeEach(() => {
      Platform.OS = 'web';
      ls = installLocalStorage();
      // Sensitive per-entity stores + persisted zustand stores + the session.
      ls.setItem('lifeos_health_logs', JSON.stringify([{ weight: 72 }]));
      ls.setItem('lifeos_food_entries', JSON.stringify([{ foodName: 'x' }]));
      ls.setItem('lifeos_blood_reports', JSON.stringify([{ id: 'b' }]));
      ls.setItem('lifeos_contacts', JSON.stringify([{ id: 'c' }]));
      ls.setItem('lifeos_gamification', JSON.stringify([{ totalXP: 99 }]));
      ls.setItem('lifeos_flags_v3', JSON.stringify({ state: {} }));
      ls.setItem('lifeos_session', 'user-1');
      // Non-LifeOS keys: Supabase token (cleared by supabaseSignOut) + unrelated.
      ls.setItem('sb-ref-auth-token', 'token');
      ls.setItem('unrelated_key', 'keep');
    });

    it('removes every lifeos_* localStorage entry (sensitive + persisted stores)', async () => {
      await clearAllLocalData();
      for (const k of [
        'lifeos_health_logs', 'lifeos_food_entries', 'lifeos_blood_reports',
        'lifeos_contacts', 'lifeos_gamification', 'lifeos_flags_v3', 'lifeos_session',
      ]) {
        expect(ls.getItem(k)).toBeNull();
      }
    });

    it('leaves non-lifeos keys untouched (Supabase token / unrelated)', async () => {
      await clearAllLocalData();
      expect(ls.getItem('sb-ref-auth-token')).toBe('token');
      expect(ls.getItem('unrelated_key')).toBe('keep');
    });

    it('clears the finance Dexie store and never touches native SQLite', async () => {
      await clearAllLocalData();
      expect(clearAllTransactions).toHaveBeenCalledTimes(1);
      expect(clearAllNativeTables).not.toHaveBeenCalled();
    });

    it('does not throw when localStorage is unavailable', async () => {
      uninstallLocalStorage();
      await expect(clearAllLocalData()).resolves.toBeUndefined();
      // Still attempts the Dexie clear even if localStorage is gone.
      expect(clearAllTransactions).toHaveBeenCalledTimes(1);
    });
  });

  describe('native', () => {
    beforeEach(() => { Platform.OS = 'ios'; });

    it('empties all SQLite tables and never touches the (web-only) finance Dexie store', async () => {
      await clearAllLocalData();
      expect(clearAllNativeTables).toHaveBeenCalledTimes(1);
      expect(clearAllTransactions).not.toHaveBeenCalled();
    });
  });
});
