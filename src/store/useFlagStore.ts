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
  // v2 closes the Today↔Reflect loop: AI-adapted tomorrow + weekly profile
  // refresh + replan CTA. Default-on so cold-launch (before /v1/config resolves)
  // doesn't silently drop users onto the legacy verbatim-clone path. Worker
  // serves as kill switch only.
  onboarding_v2: true,
  // Event-sourced write log feeding future cross-device sync. Observer-only;
  // failures inside the log never surface to the user. Default-on so beta
  // history accumulates; flip off in the Worker if it ever misbehaves.
  mutation_log_enabled: true,
  // P1-T5 cross-device sync engine (push to Supabase via the Worker). The
  // remote kill switch — default OFF until rollout; requires mutation_log_enabled.
  // Flip on per-cohort from the Worker /v1/config; flip off to freeze sync.
  sync_engine_enabled: false,
  // P1-T9 mutation-log compaction (collapses synced/dormant entities into
  // checkpoints to bound log growth). Off until device-validated — it deletes
  // log rows. Independent of sync_engine_enabled.
  compaction_enabled: false,
  // P1-T8 encrypted backup/export/import UI (Settings). Off until the native
  // file/SQLite paths are device-validated — import OVERWRITES local data. The
  // crypto core is unit-tested; the plumbing is not yet runtime-tested.
  backup_enabled: false,
  // Multi-step agent for goal decomposition. Off by default — flip on per-user
  // to A/B against the single-shot baseline. Kill criterion lives in migration
  // 0004_ai_suggestions.sql.
  agent_goal_decomp: false,
  // Tool-using "what should I do next?" agent. Off by default — requires the
  // proxy's Gemini function-calling passthrough. Logged to ai_suggestions
  // (task 'what_next') for outcome tracking.
  agent_what_next: false,
  // Propose-and-confirm "coach": the what-next agent can also PROPOSE actions
  // (add a block, mark complete/skipped, adjust a goal) that the user confirms
  // per-item. Off by default; requires the same function-calling passthrough as
  // agent_what_next. Supersedes the read-only WhatNextCard on Today when on.
  // Nothing mutates without an explicit confirm — see actionQueue.commitActions.
  ai_coach_actions: false,
};

interface FlagState {
  flags: Record<string, unknown>;
  fetchedAt: number | null;
  loading: boolean;
  error: string | null;
  fetchFlags: (opts?: { email?: string; force?: boolean }) => Promise<void>;
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
        // `force` (used on boot) bypasses the staleness window so a flag flip
        // in the Worker/Supabase takes effect on the next app launch instead of
        // up to STALE_MS later — and survives reloads (the persisted fetchedAt
        // would otherwise keep serving the stale value). Persisted flags still
        // act as the immediate/offline value until this fetch resolves.
        const fetchedAt = get().fetchedAt;
        if (!opts?.force && fetchedAt && Date.now() - fetchedAt < STALE_MS) return;

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
      // Bumped to v2 (2026-05-29): onboarding_v2 added as default-on so
      // existing persisted state from before the addition doesn't shadow it.
      name: 'lifeos_flags_v2',
      storage,
      partialize: (state) => ({ flags: state.flags, fetchedAt: state.fetchedAt }),
    },
  ),
);
