import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL || '';
const STALE_MS = 5 * 60 * 1000;

const FALLBACK_FLAGS: Record<string, unknown> = {
  discovery_import_enabled: true,
  chatbot_beta: false,
  gmail_finance_enabled: true,
  evening_reflect_enabled: true,
  polymath_enabled: true,
};

interface FlagState {
  flags: Record<string, unknown>;
  fetchedAt: number | null;
  loading: boolean;
  error: string | null;
  fetchFlags: (opts?: { email?: string }) => Promise<void>;
  isEnabled: (key: string) => boolean;
  getFlag: <T = unknown>(key: string, fallback: T) => T;
}

const storage = createJSONStorage(() =>
  Platform.OS === 'web' ? window.localStorage : AsyncStorage,
);

export const useFlagStore = create<FlagState>()(
  persist(
    (set, get) => ({
      flags: { ...FALLBACK_FLAGS },
      fetchedAt: null,
      loading: false,
      error: null,

      fetchFlags: async (opts) => {
        if (!PROXY_URL) {
          set({ flags: { ...FALLBACK_FLAGS }, fetchedAt: Date.now() });
          return;
        }
        const fetchedAt = get().fetchedAt;
        if (fetchedAt && Date.now() - fetchedAt < STALE_MS) return;

        set({ loading: true, error: null });
        try {
          const params = new URLSearchParams({
            platform: Platform.OS,
            app_version: Constants.expoConfig?.version || 'dev',
            ...(opts?.email ? { email: opts.email } : {}),
          });
          const res = await fetch(`${PROXY_URL}/v1/config?${params.toString()}`);
          if (!res.ok) throw new Error(`config ${res.status}`);
          const json = (await res.json()) as { flags: Record<string, unknown> };
          set({
            flags: { ...FALLBACK_FLAGS, ...json.flags },
            fetchedAt: Date.now(),
            loading: false,
          });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : 'flag fetch failed', loading: false });
        }
      },

      isEnabled: (key) => Boolean(get().flags[key]),
      getFlag: <T,>(key: string, fallback: T): T =>
        (get().flags[key] as T | undefined) ?? fallback,
    }),
    {
      // Bump `_v1` if FALLBACK_FLAGS gains a flag whose default flipped —
      // we'd want clients to re-fetch rather than serve stale persisted state.
      name: 'lifeos_flags_v1',
      storage,
      partialize: (state) => ({ flags: state.flags, fetchedAt: state.fetchedAt }),
    },
  ),
);
