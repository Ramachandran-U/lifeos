/**
 * Search the bundled food database.
 *
 * Pure-function ranking, no deps. For ~60 items it's faster than fuse.js
 * and easier to debug. When the dataset grows past ~2,000 items (full
 * IFCT + INDB import) consider swapping for fuse.js with the same
 * `searchFoods(query)` signature.
 */

import { FOODS, type FoodItem, type FoodMacros, type FoodServing } from '@/data/foods';

const MAX_RESULTS = 12;

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(s: string): string[] {
  return normalize(s).split(' ').filter(Boolean);
}

interface Scored {
  item: FoodItem;
  score: number;
}

function scoreItem(item: FoodItem, query: string, qTokens: string[]): number {
  const haystacks: string[] = [item.name, ...(item.aliases ?? [])];
  let best = 0;

  for (const raw of haystacks) {
    const h = normalize(raw);
    if (h === query) return 1000; // exact match — short-circuit
    if (h.startsWith(query)) {
      best = Math.max(best, 800);
      continue;
    }
    if (h.includes(query)) {
      best = Math.max(best, 600);
      continue;
    }
    // Token-level: every query token appears somewhere in haystack
    const hTokens = tokens(raw);
    const allTokensMatch = qTokens.every((q) => hTokens.some((t) => t.startsWith(q)));
    if (allTokensMatch) best = Math.max(best, 400);
  }

  return best;
}

export function searchFoods(rawQuery: string, limit = MAX_RESULTS): FoodItem[] {
  const query = normalize(rawQuery);
  if (!query) return [];
  const qTokens = tokens(rawQuery);

  const scored: Scored[] = [];
  for (const item of FOODS) {
    const score = scoreItem(item, query, qTokens);
    if (score > 0) scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}

/**
 * Scale a serving's macros to a target gram weight. Used when the user
 * adjusts the quantity slider away from the default serving size.
 */
export function scaleMacros(serving: FoodServing, targetG: number): FoodMacros {
  if (serving.quantityG <= 0 || targetG <= 0) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }
  const ratio = targetG / serving.quantityG;
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    calories: Math.round(serving.calories * ratio),
    protein: round(serving.protein * ratio),
    carbs: round(serving.carbs * ratio),
    fat: round(serving.fat * ratio),
    fiber: serving.fiber !== undefined ? round(serving.fiber * ratio) : undefined,
  };
}
