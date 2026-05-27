/**
 * Caches the Monthly Money Review per calendar month so the planning-tier AI
 * call fires at most once a month (or on explicit refresh), not on every open.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { MonthlyMoneyReview } from '@/ai/types';

interface CachedReview {
  monthKey: string; // YYYY-MM
  review: MonthlyMoneyReview;
  /** Transaction count at generation time — if current count differs, the
   *  review is stale (new transactions synced since it was generated). */
  txCount?: number;
}

interface MoneyReviewState {
  cache: CachedReview | null;
  setCache: (c: CachedReview) => void;
}

const storage = createJSONStorage(() =>
  Platform.OS === 'web' ? window.localStorage : AsyncStorage,
);

export const useMoneyReviewStore = create<MoneyReviewState>()(
  persist(
    (set) => ({
      cache: null,
      setCache: (cache) => set({ cache }),
    }),
    { name: 'lifeos_money_review_v1', storage },
  ),
);

export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
