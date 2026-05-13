/**
 * Per-domain rolling 7-day score history.
 *
 * The gamification table only stores *current* domain scores. To show a
 * delta ("↑5 since last week") and a sparkline on the Rewards screen, we
 * need history — but proper history tracking would require a new SQLite
 * column, a migration, and a cron-like daily snapshot job.
 *
 * This store is the small pragmatic version: a 7-entry rolling window per
 * domain, persisted via zustand-persist. `record(scores)` is idempotent
 * within a calendar day (device local), so
 * it's safe to call from every app-focus effect.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { DomainScores } from '@/utils/gamification';

const WINDOW_SIZE = 7;

export interface ScorePoint {
  /** YYYY-MM-DD (device local calendar) — the day this snapshot was taken. */
  date: string;
  score: number;
}

interface DomainHistoryState {
  entries: Partial<Record<keyof DomainScores, ScorePoint[]>>;
  /**
   * Append today's scores to the rolling window — but only if today
   * isn't already represented. Safe to call from every app-focus effect.
   */
  record: (scores: DomainScores) => void;
  /** Convenience: 7-day score array for a domain, oldest first. */
  historyFor: (domain: keyof DomainScores) => number[];
  /** Convenience: difference between latest and oldest in the window. */
  deltaFor: (domain: keyof DomainScores) => number;
  /**
   * Best-effort scores from the most recent snapshot strictly before `todayLocal`
   * (YYYY-MM-DD device calendar). Missing domains copy `fallback` so the radar
   * stays a closed hex; returns null if there is no prior history at all.
   */
  getPriorDayScores: (todayLocal: string, fallback: DomainScores) => DomainScores | null;
}

const storage = createJSONStorage(() =>
  Platform.OS === 'web' ? window.localStorage : AsyncStorage,
);

function todayLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DOMAIN_KEYS: (keyof DomainScores)[] = ['goals', 'health', 'finance', 'career', 'social', 'mind'];

export const useDomainHistoryStore = create<DomainHistoryState>()(
  persist(
    (set, get) => ({
      entries: {},

      record: (scores) => {
        const today = todayLocalISO();
        const current = get().entries;
        const nextEntries: typeof current = { ...current };
        let changed = false;
        for (const [key, score] of Object.entries(scores) as Array<[keyof DomainScores, number]>) {
          const arr = current[key] ?? [];
          const last = arr[arr.length - 1];
          if (last?.date === today) {
            // Already recorded today; refresh the score in case it ratcheted.
            if (last.score !== score) {
              nextEntries[key] = [...arr.slice(0, -1), { date: today, score }];
              changed = true;
            }
          } else {
            const appended = [...arr, { date: today, score }];
            nextEntries[key] = appended.slice(-WINDOW_SIZE);
            changed = true;
          }
        }
        if (changed) set({ entries: nextEntries });
      },

      historyFor: (domain) => {
        const arr = get().entries[domain] ?? [];
        return arr.map((p) => p.score);
      },

      deltaFor: (domain) => {
        const arr = get().entries[domain] ?? [];
        if (arr.length < 2) return 0;
        return arr[arr.length - 1]!.score - arr[0]!.score;
      },

      getPriorDayScores: (todayLocal, fallback) => {
        const entries = get().entries;
        let anyPrior = false;
        const out: DomainScores = { ...fallback };
        for (const k of DOMAIN_KEYS) {
          const arr = entries[k] ?? [];
          const prior = [...arr]
            .filter((p) => p.date < todayLocal)
            .sort((a, b) => a.date.localeCompare(b.date))
            .pop();
          if (prior) {
            out[k] = prior.score;
            anyPrior = true;
          }
        }
        return anyPrior ? out : null;
      },
    }),
    {
      name: 'lifeos_domain_history_v1',
      storage,
      partialize: (state) => ({ entries: state.entries }),
    },
  ),
);
