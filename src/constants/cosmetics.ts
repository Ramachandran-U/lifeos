/**
 * Companion cosmetics (variable_rewards_v1 → companion_v1).
 *
 * Drop-only collectibles: the ONLY way to own one is a chest roll — there is
 * no purchase path and never will be (compassion constraint: no paywalled
 * mechanics). Owned ids live in the gamification `cosmetics` JSON column and
 * merge across devices as a sorted set union (see mergeGamification).
 *
 * Wave 4's CompanionSheet renders the equip grid from this list; `slot`
 * exists so equipping one aura doesn't unequip a hat.
 */

export type CosmeticSlot = 'aura' | 'headwear' | 'trail';

export interface CosmeticMeta {
  id: string;
  label: string;
  /** Render glyph until the Rive companion binds real attachments (W4). */
  emoji: string;
  slot: CosmeticSlot;
}

export const COSMETICS: readonly CosmeticMeta[] = [
  { id: 'aura_aurora', label: 'Aurora Glow', emoji: '🌌', slot: 'aura' },
  { id: 'aura_ember', label: 'Ember Warmth', emoji: '🔥', slot: 'aura' },
  { id: 'hat_sprout', label: 'Tiny Sprout', emoji: '🌱', slot: 'headwear' },
  { id: 'hat_crown', label: 'Little Crown', emoji: '👑', slot: 'headwear' },
  { id: 'trail_stardust', label: 'Stardust Trail', emoji: '✨', slot: 'trail' },
  { id: 'trail_petals', label: 'Petal Drift', emoji: '🌸', slot: 'trail' },
] as const;

export const COSMETIC_IDS: readonly string[] = COSMETICS.map((c) => c.id);

export function cosmeticById(id: string): CosmeticMeta | undefined {
  return COSMETICS.find((c) => c.id === id);
}
