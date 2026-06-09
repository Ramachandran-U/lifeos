import { create } from 'zustand';
import {
  getChestById,
  getPendingChests,
  markChestOpened,
  type ChestRecord,
} from '@/db/queries/chests';
import { rollLoot, type ChestContents } from '@/gamification/lootTable';
import { cosmeticById } from '@/constants/cosmetics';
import { enqueueXPReward } from './useRewardQueueStore';
import { useGameStore } from './useGameStore';
import { track, EVENTS } from '@/utils/telemetry';

/**
 * Chest state (variable_rewards_v1). Pending rows live in the `chests` table;
 * this store is the reactive cache + the single open/claim orchestrator.
 *
 * Opening a chest:
 *   1. status guard (idempotent — double-taps can't double-roll)
 *   2. roll via the pure seeded lootTable (seed fixed at grant)
 *   3. persist the sealed contents (markChestOpened)
 *   4. apply: XP through useGameStore.grantXP (THE single XP path — ledger +
 *      freeze accrual + level-ups), freeze via addFreeze (LWW counter),
 *      cosmetic via addCosmetic (sorted-union set)
 *
 * Chests only ADD — there is no branch here that takes anything away, and no
 * timer that invalidates a pending row. Renders gate on the flag + the
 * gamification preference; this store stays mounted regardless so a flag flip
 * never strands state.
 */

interface ChestState {
  pending: ChestRecord[];
  /** The just-opened result for the reveal overlay; null when dismissed. */
  lastOpened: { chest: ChestRecord; contents: ChestContents } | null;

  refresh: (userId: string) => void;
  /** Open a pending chest. Returns the rolled contents, or null if not openable. */
  open: (userId: string, chestId: string) => ChestContents | null;
  dismissReveal: () => void;
}

export const useChestStore = create<ChestState>((set, get) => ({
  pending: [],
  lastOpened: null,

  refresh: (userId) => {
    if (!userId) return;
    try {
      set({ pending: getPendingChests(userId) });
    } catch {
      /* a read failure must never break the rewards tab */
    }
  },

  open: (userId, chestId) => {
    const chest = getChestById(chestId);
    if (!chest || chest.status !== 'pending') return null;

    const game = useGameStore.getState();

    const contents = rollLoot(chest.seed, {
      freezesBanked: game.streakFreezes,
      ownedCosmetics: game.cosmetics,
    });
    markChestOpened(chestId, contents);

    if (contents.type === 'xp') {
      game.grantXP(userId, { amount: contents.amount, source: 'chest', refId: chestId });
      enqueueXPReward(contents.amount);
    } else if (contents.type === 'freeze') {
      game.addFreeze(userId);
    } else {
      game.addCosmetic(userId, contents.cosmeticId);
    }

    track(EVENTS.chestOpened, {
      source: chest.source,
      drop: contents.type,
      cosmetic: contents.type === 'cosmetic' ? cosmeticById(contents.cosmeticId)?.id : undefined,
    });

    set({
      pending: getPendingChests(userId),
      lastOpened: { chest, contents },
    });
    return contents;
  },

  dismissReveal: () => set({ lastOpened: null }),
}));
