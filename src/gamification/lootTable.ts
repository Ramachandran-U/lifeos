import { rngFromKey, pickWeighted } from '@/utils/seededRandom';
import { COSMETIC_IDS } from '@/constants/cosmetics';
import { MAX_FREEZES_BANKED } from './streakEngine';

/**
 * Chest loot table (variable_rewards_v1) — pure and seeded.
 *
 * ETHICS BY CONSTRUCTION (the whole point of this file being pure):
 *  - Chests only ADD. Every branch returns a reward; there is no "dud",
 *    no loss, no debuff.
 *  - The roll is sealed at GRANT time: the chest row stores its seed, and
 *    rollLoot(seed, ctx) is deterministic — opening sooner/later cannot
 *    change the outcome, so there is nothing to optimise or fear. No FOMO.
 *  - Overflow never wastes effort: a freeze rolled on a full bank converts
 *    to XP; a cosmetic rolled when all are owned converts to XP.
 *  - No purchase path touches this table. Weights are fixed constants.
 *
 * All randomness flows through src/utils/seededRandom (mulberry32) — no
 * Math.random anywhere in the mechanic.
 */

export type ChestContents =
  | { type: 'xp'; amount: number }
  | { type: 'freeze' }
  | { type: 'cosmetic'; cosmeticId: string };

export interface LootContext {
  /** Freezes currently banked — a full bank converts a freeze roll to XP. */
  freezesBanked: number;
  /** Cosmetic ids already owned — exhausted pool converts the roll to XP. */
  ownedCosmetics: readonly string[];
}

/** Roll weights: xp 60% · freeze 25% · cosmetic 15%. */
export const LOOT_WEIGHTS = { xp: 60, freeze: 25, cosmetic: 15 } as const;

/** XP rolls are uniform in [XP_ROLL_MIN, XP_ROLL_MAX]. */
export const XP_ROLL_MIN = 25;
export const XP_ROLL_MAX = 75;

function rollXpAmount(rng: () => number): number {
  return XP_ROLL_MIN + Math.floor(rng() * (XP_ROLL_MAX - XP_ROLL_MIN + 1));
}

export function rollLoot(seed: string, ctx: LootContext): ChestContents {
  const rng = rngFromKey(seed);
  const slot = pickWeighted(rng, [LOOT_WEIGHTS.xp, LOOT_WEIGHTS.freeze, LOOT_WEIGHTS.cosmetic]);

  if (slot === 1) {
    // Freeze — unless the bank is full, in which case the roll converts to
    // XP so the reward is never wasted (never silently dropped).
    if (ctx.freezesBanked < MAX_FREEZES_BANKED) return { type: 'freeze' };
    return { type: 'xp', amount: rollXpAmount(rng) };
  }

  if (slot === 2) {
    const unowned = COSMETIC_IDS.filter((id) => !ctx.ownedCosmetics.includes(id));
    if (unowned.length > 0) {
      return { type: 'cosmetic', cosmeticId: unowned[Math.floor(rng() * unowned.length)] };
    }
    // Collection complete — convert to XP rather than dropping the reward.
    return { type: 'xp', amount: rollXpAmount(rng) };
  }

  return { type: 'xp', amount: rollXpAmount(rng) };
}
