/**
 * Rolling daily history of cumulative XP.
 *
 * The gamification table only stores the *current* `totalXP` (a running
 * counter). To draw a real "7-day XP" chart on the Rewards screen we need a
 * per-day series — but a SQLite column + migration + daily snapshot job is
 * overkill. This is the small pragmatic version, mirroring
 * `useDomainHistoryStore`: a rolling window of `{date, totalXP}` snapshots,
 * persisted via zustand-persist. `record(totalXP)` is idempotent within a UTC
 * day (refreshing the day's value if XP ratcheted up), so it's safe to call on
 * every app-focus / loadFromDB.
 *
 * Daily XP *gained* is derived by differencing consecutive cumulative
 * snapshots — so the chart shows real earned-per-day, never mock data.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const WINDOW_SIZE = 90;

export interface XpPoint {
  /** YYYY-MM-DD (UTC) — the day this snapshot was taken. */
  date: string;
  /** Cumulative total XP at the time of the snapshot. */
  totalXP: number;
}

interface XpHistoryState {
  entries: XpPoint[];
  /**
   * Append today's cumulative total XP to the rolling window — but only if
   * today isn't already represented (refreshing the value if it grew). Safe to
   * call from every app-focus effect / loadFromDB.
   */
  record: (totalXP: number) => void;
  /**
   * Daily XP *gained* over the last `days` snapshots (default 7), oldest first.
   * Derived by differencing consecutive cumulative snapshots; the first
   * recorded day has no prior baseline so it yields no gain entry.
   */
  dailyGains: (days?: number) => number[];
  /** Total XP gained across the last `days` (sum of `dailyGains`). */
  gainedInWindow: (days?: number) => number;
}

const storage = createJSONStorage(() =>
  Platform.OS === 'web' ? window.localStorage : AsyncStorage,
);

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export const useXpHistoryStore = create<XpHistoryState>()(
  persist(
    (set, get) => ({
      entries: [],

      record: (totalXP) => {
        const today = todayUtc();
        const arr = get().entries;
        const last = arr[arr.length - 1];
        if (last?.date === today) {
          // Already recorded today; refresh in case XP ratcheted up.
          if (last.totalXP !== totalXP) {
            set({ entries: [...arr.slice(0, -1), { date: today, totalXP }] });
          }
        } else {
          set({ entries: [...arr, { date: today, totalXP }].slice(-WINDOW_SIZE) });
        }
      },

      dailyGains: (days = 7) => {
        const arr = get().entries;
        const gains: number[] = [];
        for (let i = 1; i < arr.length; i++) {
          // Clamp at 0 — totalXP never decreases, but guard against any
          // out-of-order/reset edge case so the chart can't render negatives.
          gains.push(Math.max(0, arr[i].totalXP - arr[i - 1].totalXP));
        }
        return gains.slice(-days);
      },

      gainedInWindow: (days = 7) => get().dailyGains(days).reduce((a, b) => a + b, 0),
    }),
    {
      name: 'lifeos_xp_history_v1',
      storage,
      partialize: (state) => ({ entries: state.entries }),
      version: 1,
    },
  ),
);
