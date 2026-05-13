import type { FoodItem } from './types';
import seed from './seed';
import ifct from './ifct.json';
import indb from './indb.json';

export type { FoodItem, FoodMacros, FoodServing, FoodSource } from './types';

/**
 * Merged food database — three sources, in priority order:
 *   1. seed.ts (~60) — hand-curated recipes for the common-case quick search
 *      ("Vegetable biryani", "Roti", "Dal tadka"). These win on tie because
 *      they sort first and our search ranking is stable.
 *   2. INDB 2024 (~1,000) — the big recipe layer (paneer butter masala,
 *      every parantha variant, regional dishes, kebabs, etc.). Per-100g
 *      values scaled to a heuristic serving size by unit keyword.
 *   3. IFCT 2017 (~530) — whole-foods composition tables from NIN: nuts,
 *      fruits, fish, eggs, leafy greens, oils, spices. Multilingual aliases
 *      cover Hindi/Tamil/Telugu/Marathi/Kannada/Malayalam names.
 *
 * Total: ~1,600 items, ~370 KB raw JSON, ~90 KB gzipped on the wire.
 */
export const FOODS: FoodItem[] = [
  ...seed,
  ...(indb as FoodItem[]),
  ...(ifct as FoodItem[]),
];
