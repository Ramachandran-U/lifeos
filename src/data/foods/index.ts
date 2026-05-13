import type { FoodItem } from './types';
import seed from './seed';
import ifct from './ifct.json';

export type { FoodItem, FoodMacros, FoodServing, FoodSource } from './types';

/**
 * Merged food database — seed entries first (curated recipes like biryani,
 * paratha that the IFCT raw-foods data doesn't cover), then 528 IFCT 2017
 * whole-food entries (almonds, fruits, fish, eggs, etc.). When a query
 * matches in both, the seed entry wins because the search ranking sorts
 * by score (and earlier insertion order ties).
 *
 * Total: ~590 items, ~180 KB raw JSON, ~50 KB gzipped on the wire.
 */
export const FOODS: FoodItem[] = [...seed, ...(ifct as FoodItem[])];
