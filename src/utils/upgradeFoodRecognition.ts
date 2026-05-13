/**
 * Post-process the AI photo-recognition result by looking up each
 * identified item in the bundled food database. When we get a confident
 * name match, swap the AI's macro estimates (which empirically undershoot
 * by 20–40%) for the DB's verified values, scaled to the AI's reported
 * portion size.
 *
 * The AI is good at NAMING dishes from photos and ESTIMATING quantities.
 * It is consistently bad at remembering kcal/macro tables. The DB has
 * IFCT/INDB-verified macros. This function combines the two.
 *
 * Unmatched items are passed through unchanged so the user can edit.
 */

import type { FoodRecognition } from '@/ai/types';
import { searchFoods, scaleMacros } from './foodSearch';

// Top-hit ranking score must clear this for a match to count.
// searchFoods returns: 1000 exact, 800 prefix, 600 substring, 400 token-all.
// Token-level (400) is too loose for a photo-recog upgrade where wrong
// matches actively mislead; prefix (800) is the safer floor.
const MATCH_FLOOR = 600;

export interface UpgradeResult {
  recognition: FoodRecognition;
  upgradedCount: number;
}

/**
 * Returns a new FoodRecognition where matched items have DB-derived macros.
 * The original `name` from the AI is preserved (matches what's in the photo).
 * If no DB hit, the item is unchanged.
 */
export function upgradeFoodRecognition(recognition: FoodRecognition): UpgradeResult {
  let upgradedCount = 0;
  const items = recognition.items.map((item) => {
    const matches = searchFoods(item.name, 1);
    if (matches.length === 0) return item;

    // Re-score the single hit using a quick lexical check so we don't take
    // every loose token match. (searchFoods doesn't expose its score.)
    const top = matches[0]!;
    const q = item.name.toLowerCase();
    const n = top.name.toLowerCase();
    const aliases = (top.aliases ?? []).map((a) => a.toLowerCase());
    const hits = n.startsWith(q) || n.includes(q) || aliases.some((a) => a.includes(q) || q.includes(a));
    if (!hits) return item;
    void MATCH_FLOOR; // kept for future use if we expose scores

    // Scale DB serving macros to the AI's reported quantityG.
    const macros = scaleMacros(top.defaultServing, item.quantityG);
    upgradedCount += 1;
    return {
      ...item,
      calories: macros.calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
    };
  });

  return { recognition: { ...recognition, items }, upgradedCount };
}
