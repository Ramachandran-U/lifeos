import { create } from 'zustand';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deriveMood } from '@/companion/mood';
import type { CompanionIdentity, CompanionMood, MoodInputs } from '@/companion/types';
import { detectStreakAtRisk } from '@/cognition/streakAtRisk';
import { getOrCreateGamification, updateGamification } from '@/db/queries/gamification';
import { getRoutineBlocksByDate } from '@/db/queries/routine';
import { getPendingChests } from '@/db/queries/chests';
import { getLatestInsight } from '@/db/queries/cognitiveInsights';
import { localDayISO } from '@/db/queries/xpEvents';
import { useGameStore } from './useGameStore';
import { cosmeticById } from '@/constants/cosmetics';
import { track, EVENTS } from '@/utils/telemetry';

/**
 * Companion state (R3, flag: companion_v1).
 *
 * Mood is DERIVED (pure deriveMood over injected inputs) and never persisted —
 * two devices recompute it from their own view of the data. Only the identity
 * (name + equipped cosmetics) persists, in the gamification `companion` JSON
 * column, which mergeGamification treats as LWW (document-shaped).
 *
 * Renders gate on the flag + gamification preference at the call site; the
 * store itself stays mounted so a flag flip never strands state.
 */

const APP_OPENED_KEY = 'lifeos_app_opened_last'; // written by utils/retention.ts

const DOMAINS = ['goals', 'health', 'finance', 'career', 'social', 'polymath'] as const;

interface CompanionState {
  mood: CompanionMood;
  reason: string;
  identity: CompanionIdentity | null;

  /** Load identity + derive a fresh mood. Call on Today focus. */
  recompute: (userId: string, now?: Date) => Promise<void>;
  /** First-run naming (and renames). Persists via the LWW companion column. */
  setName: (userId: string, name: string) => void;
  /** Equip an OWNED cosmetic; replaces any equipped item in the same slot. */
  equip: (userId: string, cosmeticId: string) => void;
  unequip: (userId: string, cosmeticId: string) => void;
}

function readIdentity(userId: string): CompanionIdentity | null {
  try {
    const raw = getOrCreateGamification(userId).companion;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CompanionIdentity>;
    if (typeof parsed.name !== 'string' || !parsed.name.trim()) return null;
    return {
      name: parsed.name,
      createdAt: parsed.createdAt ?? new Date().toISOString(),
      equipped: Array.isArray(parsed.equipped)
        ? parsed.equipped.filter((v): v is string => typeof v === 'string')
        : [],
    };
  } catch {
    return null;
  }
}

function persistIdentity(userId: string, identity: CompanionIdentity): void {
  try {
    updateGamification(userId, { companion: JSON.stringify(identity) });
  } catch {
    /* identity persistence is additive — never break the sheet */
  }
}

async function daysSinceLastOpen(now: Date): Promise<number> {
  try {
    const raw =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.localStorage.getItem(APP_OPENED_KEY)
        : await AsyncStorage.getItem(APP_OPENED_KEY);
    if (!raw) return 0;
    const ms = now.getTime() - Date.parse(`${raw}T00:00:00Z`);
    if (Number.isNaN(ms)) return 0;
    return Math.max(0, Math.floor(ms / 86_400_000));
  } catch {
    return 0;
  }
}

function hasStagnantDomain(userId: string): boolean {
  try {
    for (const domain of DOMAINS) {
      const insight = getLatestInsight(userId, 'domain_stagnation', domain);
      if (insight && insight.status === 'proposed') return true;
    }
  } catch {
    /* insights are an enrichment — never block mood derivation */
  }
  return false;
}

export const useCompanionStore = create<CompanionState>((set, get) => ({
  mood: 'content',
  reason: 'All calm here. Happy to see you.',
  identity: null,

  recompute: async (userId, now = new Date()) => {
    if (!userId) return;
    try {
      const identity = readIdentity(userId);
      const { streaks } = useGameStore.getState();
      const today = localDayISO(now);

      const blocks = getRoutineBlocksByDate(today) as { status?: string }[];
      const completion =
        blocks.length > 0
          ? blocks.filter((b) => b.status === 'completed').length / blocks.length
          : 0;

      // Streaks is a closed interface; the detector wants an index-signature
      // map — project the three fields it reads explicitly.
      const streakMap = Object.fromEntries(
        Object.entries(streaks).map(([k, v]) => [
          k,
          { count: v.count, lastDate: v.lastDate, graceUsed: v.graceUsed },
        ]),
      );
      const atRisk = detectStreakAtRisk({
        streaks: streakMap,
        today,
        currentHour: now.getHours(),
        cooldownOk: () => true, // mood reflects state; notification cooldowns live elsewhere
      });

      const inputs: MoodInputs = {
        bestActiveStreak: Math.max(0, ...Object.values(streaks).map((s) => s.count)),
        streakAtRisk: atRisk !== null,
        todayCompletionPct: completion,
        daysSinceLastOpen: await daysSinceLastOpen(now),
        stagnantDomain: hasStagnantDomain(userId),
        unclaimedChests: getPendingChests(userId).length,
      };

      const { mood, reason } = deriveMood(inputs);
      set({ mood, reason, identity });
    } catch {
      /* keep the previous mood — a derivation failure must never crash Today */
    }
  },

  setName: (userId, name) => {
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) return;
    const prior = get().identity;
    const identity: CompanionIdentity = {
      name: trimmed,
      createdAt: prior?.createdAt ?? new Date().toISOString(),
      equipped: prior?.equipped ?? [],
    };
    persistIdentity(userId, identity);
    set({ identity });
    track(EVENTS.companionNamed, { renamed: prior !== null });
  },

  equip: (userId, cosmeticId) => {
    const identity = get().identity;
    if (!identity) return;
    const meta = cosmeticById(cosmeticId);
    if (!meta) return;
    // Owned check — equipping something you don't own is a no-op, not an error.
    if (!useGameStore.getState().cosmetics.includes(cosmeticId)) return;
    // One per slot: drop any currently-equipped cosmetic occupying this slot.
    const equipped = [
      ...identity.equipped.filter((id) => cosmeticById(id)?.slot !== meta.slot),
      cosmeticId,
    ].sort();
    const next = { ...identity, equipped };
    persistIdentity(userId, next);
    set({ identity: next });
  },

  unequip: (userId, cosmeticId) => {
    const identity = get().identity;
    if (!identity) return;
    const next = { ...identity, equipped: identity.equipped.filter((id) => id !== cosmeticId) };
    persistIdentity(userId, next);
    set({ identity: next });
  },
}));
