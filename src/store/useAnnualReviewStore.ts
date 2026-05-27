/**
 * P4-03 cache. The Annual Review is a once-a-year, reasoning-tier (Opus)
 * report, so we must NOT regenerate it on every screen open. Cache the
 * generated review keyed by calendar year; a manual refresh overrides it.
 * Persisted across reloads (localStorage on web, AsyncStorage on native).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { AnnualReview } from '@/ai/types';

interface CachedReview {
  year: number;
  review: AnnualReview;
}

interface AnnualReviewState {
  cache: CachedReview | null;
  setCache: (c: CachedReview) => void;
}

const storage = createJSONStorage(() =>
  Platform.OS === 'web' ? window.localStorage : AsyncStorage,
);

export const useAnnualReviewStore = create<AnnualReviewState>()(
  persist(
    (set) => ({
      cache: null,
      setCache: (cache) => set({ cache }),
    }),
    { name: 'lifeos_annual_review_v1', storage },
  ),
);
