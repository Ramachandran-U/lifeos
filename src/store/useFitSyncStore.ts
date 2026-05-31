/**
 * Last Google Fit sync, cached across navigation.
 *
 * The synced daily points and workouts used to live only in the Health
 * screen's local `useState`, so leaving the tab unmounted the screen and
 * threw the data away — the user had to re-sync every time they came back.
 * This store persists the most recent sync (via zustand-persist) so the
 * Fit dashboard rehydrates instantly on focus, while a fresh `sync` still
 * refreshes it from the live Google Fit API.
 *
 * This is a display cache only; sleep / weight / recovery continue to be
 * written to health logs by the sync handler for planning to read.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { DailyFitPoint, WorkoutSession } from '@/integrations/googleFit/client';

interface FitSyncState {
  days: DailyFitPoint[];
  workouts: WorkoutSession[];
  /** Epoch ms of the last successful sync, or null if never synced. */
  lastSyncedAt: number | null;
  /** Replace the cache with a fresh sync result. */
  setSync: (days: DailyFitPoint[], workouts: WorkoutSession[], syncedAt: number) => void;
  /** Drop the cache (on disconnect). */
  clear: () => void;
}

const storage = createJSONStorage(() =>
  Platform.OS === 'web' ? window.localStorage : AsyncStorage,
);

export const useFitSyncStore = create<FitSyncState>()(
  persist(
    (set) => ({
      days: [],
      workouts: [],
      lastSyncedAt: null,
      setSync: (days, workouts, syncedAt) =>
        set({ days, workouts, lastSyncedAt: syncedAt }),
      clear: () => set({ days: [], workouts: [], lastSyncedAt: null }),
    }),
    {
      name: 'lifeos_fit_sync_v1',
      storage,
      partialize: (state) => ({
        days: state.days,
        workouts: state.workouts,
        lastSyncedAt: state.lastSyncedAt,
      }),
    },
  ),
);
