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
  // per-item. Default ON (2026-06-05) — supersedes the read-only WhatNextCard on
  // Today. Requires the proxy's function-calling passthrough (deployed). Nothing
  // mutates without an explicit confirm, and each ref is re-validated at commit
  // time — see actionQueue.commitActions. The admin `flags` table remains the
  // authoritative kill switch (a row here overrides this fallback default).
  ai_coach_actions: true,
  // Agentic voice: lets the voice assistant NAVIGATE between tabs, sync Google
  // Fit on request, and PROPOSE writes (create a goal, generate a career path)
  // that the user confirms — spoken "yes" or a tap on a confirm card. Off by
  // default; requires the proxy's Gemini function-calling passthrough (same as
  // agent_what_next). When off, voice stays read-only (today's grounding tools
  // only) — behaviour-preserving. Navigation/sync execute instantly; anything
  // that creates/generates/saves goes through propose→confirm. Worker is the
  // remote kill switch.
  voice_agent_actions: false,
  // Explore GA flags — all default-on; Worker is the remote kill switch.
  // These graduated out of flags.ts (typed compile-time) into the runtime store
  // so a broken feature can be flipped off from /v1/config without a deploy.
  explore_chasing: true,
  explore_agentic_thread: true,
  explore_frontier: true,
  rabbit_hole_tree_map: true,
  // Aurora Alive retention mechanics (UI/UX revamp program). Runtime flags,
  // default OFF — flip on per-cohort from the Worker /v1/config; each is a
  // remote kill switch for its wave. All additionally respect
  // usePreferencesStore.gamification !== 'off' at the render layer.
  streak_protection_v1: false, // W1: earned freezes + milestone tiers + 24h recovery
  quests_v2: false,            // W2: DB-backed procedural daily quests + claim/reroll
  variable_rewards_v1: false,  // W3: chest drops on peak beats (additive only, no timers)
  companion_v1: false,         // W4: companion mood/reactions (product layer)
  comeback_v1: false,          // W4: comeback chest + recovery quest + gentle nudge
  progress_map_v1: false,      // W5: ProgressPath replaces LevelLadder on Rewards
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
      // Bumped to v3 (2026-06-05): ai_coach_actions flipped default-on; drop
      // persisted `false` so existing installs pick up the acting coach.
      name: 'lifeos_flags_v3',
      storage,
      partialize: (state) => ({ flags: state.flags, fetchedAt: state.fetchedAt }),
    },
  ),
);
