/**
 * Deterministic PRNG (Aurora Alive R1+). All gamification randomness — quest
 * selection, loot rolls — goes through a SEEDED generator so behaviour is
 * reproducible: same user + same day ⇒ same quests; a chest's contents are
 * fixed at grant time by its stored seed. No Math.random() in any mechanic.
 */

/** mulberry32 — tiny, fast, good-enough distribution for game mechanics. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit string hash — turns "userId:2026-06-10" into a seed. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Convenience: a ready-to-use rng from any string key. */
export function rngFromKey(key: string): () => number {
  return mulberry32(hashSeed(key));
}

/** Weighted pick — weights need not sum to 1. Returns the picked index. */
export function pickWeighted(rng: () => number, weights: number[]): number {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (total <= 0) return 0;
  let roll = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= Math.max(0, weights[i]);
    if (roll < 0) return i;
  }
  return weights.length - 1;
}
