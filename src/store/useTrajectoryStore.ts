/**
 * P4-04: remembers when the user last opened a trajectory recalibration so
 * the quarterly prompt only nags once per calendar quarter. Persisted across
 * reloads (localStorage on web, AsyncStorage on native).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { quarterKey } from '@/utils/trajectory';

interface TrajectoryState {
  /** quarterKey() value the user last acknowledged a recalibration for. */
  lastReviewedQuarter: string | null;
  markReviewed: (quarter?: string) => void;
  /** True when the current quarter hasn't been acknowledged yet. */
  needsReview: () => boolean;
}

const storage = createJSONStorage(() =>
  Platform.OS === 'web' ? window.localStorage : AsyncStorage,
);

export const useTrajectoryStore = create<TrajectoryState>()(
  persist(
    (set, get) => ({
      lastReviewedQuarter: null,
      markReviewed: (quarter) => set({ lastReviewedQuarter: quarter ?? quarterKey() }),
      needsReview: () => get().lastReviewedQuarter !== quarterKey(),
    }),
    { name: 'lifeos_trajectory_v1', storage },
  ),
);
