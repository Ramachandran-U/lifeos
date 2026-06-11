/**
 * Hero snooze — "Not today" persistence (Ink + Signal §3.4).
 *
 * A hero's quiet action hides it until the next LOCAL day. Stored as
 * domain -> 'yyyy-MM-dd' (device-local date via date-fns `format`), so the
 * snooze expires naturally at local midnight: `isSnoozedToday` simply compares
 * the stored date to today's. No re-prompt, no badge, no timer
 * (compassion rule).
 *
 * Persistence deliberately copies the `useFitSyncStore` zustand-persist
 * pattern (localStorage on web / AsyncStorage on native).
 * `usePreferencesStore` was rejected for this: its hand-rolled persistence is
 * web-only, and a snooze must survive native restarts.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { format } from 'date-fns';

interface HeroSnoozeState {
  /** domain -> local 'yyyy-MM-dd' the hero was snoozed on. */
  snoozed: Record<string, string>;
  /** Hide `domain`'s hero for the rest of the local day. */
  snooze: (domain: string) => void;
  /** True while the device-local date still equals the snooze date. */
  isSnoozedToday: (domain: string) => boolean;
}

const localToday = () => format(new Date(), 'yyyy-MM-dd');

const storage = createJSONStorage(() =>
  Platform.OS === 'web' ? window.localStorage : AsyncStorage,
);

export const useHeroSnoozeStore = create<HeroSnoozeState>()(
  persist(
    (set, get) => ({
      snoozed: {},
      snooze: (domain) =>
        set((state) => ({ snoozed: { ...state.snoozed, [domain]: localToday() } })),
      isSnoozedToday: (domain) => get().snoozed[domain] === localToday(),
    }),
    {
      name: 'lifeos_hero_snooze_v1',
      storage,
      partialize: (state) => ({ snoozed: state.snoozed }),
    },
  ),
);
