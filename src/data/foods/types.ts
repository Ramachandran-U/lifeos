/**
 * Bundled food database — types only.
 *
 * The actual entries live in `seed.ts` (this PR) and the expansion path is
 * documented in `scripts/build-food-db.md` for importing the full
 * IFCT 2017 + INDB 2024 + USDA datasets when you're ready to scale up.
 */

export type FoodSource =
  | 'ifct-2017'        // Indian Food Composition Tables 2017 (NIN)
  | 'indb-2024'        // Indian Nutrient Databank 2024
  | 'usda'             // USDA FoodData Central
  | 'open-food-facts'  // Open Food Facts (live lookup by barcode)
  | 'curated-seed'     // Hand-curated approximations shipped with the app

export interface FoodMacros {
  /** kcal */
  calories: number;
  /** grams */
  protein: number;
  /** grams */
  carbs: number;
  /** grams */
  fat: number;
  /** grams; optional */
  fiber?: number;
}

export interface FoodServing extends FoodMacros {
  /** Grams in this serving. */
  quantityG: number;
  /** Human-readable label, e.g. "1 bowl", "1 piece", "1 cup". */
  label: string;
}

export interface FoodItem {
  /** Stable id, lowercase + dashes. */
  id: string;
  /** Canonical name shown to the user. */
  name: string;
  /** Alternative spellings / regional names for search matching. */
  aliases?: string[];
  /** Coarse grouping; affects which icon/colour to render. */
  category:
    | 'rice'
    | 'bread'
    | 'dal'
    | 'curry-veg'
    | 'curry-meat'
    | 'snack'
    | 'breakfast'
    | 'fruit'
    | 'vegetable'
    | 'beverage'
    | 'sweet'
    | 'dairy'
    | 'protein'
    | 'other';
  /** Default serving — the one shown when the user taps the entry. */
  defaultServing: FoodServing;
  /** Optional alternative servings (e.g. "1 small bowl", "1 large bowl"). */
  servings?: FoodServing[];
  /** Where the macro numbers came from. Drives the trust indicator in UI. */
  source: FoodSource;
}
