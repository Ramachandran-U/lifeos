/**
 * Open Food Facts API client.
 *
 * Free, no auth, public-internet endpoint. Returns nutrient + product info
 * for any barcode they have on file (~3M products globally, decent India
 * coverage for packaged snacks: Britannia, Parle, Haldiram, etc.).
 *
 * Endpoint shape:
 *   GET https://world.openfoodfacts.org/api/v2/product/{ean}.json
 *
 * Reference fields we use from `product`:
 *   - product_name / generic_name (display)
 *   - brands (comma-separated)
 *   - serving_size (free-form string, e.g. "30 g", "1 cup (240 ml)")
 *   - nutriments['energy-kcal_100g'] / proteins_100g / carbohydrates_100g /
 *     fat_100g / fiber_100g
 *
 * License: ODbL — attribution required if we ever redisplay the raw
 * dataset. For per-user lookup in-app, fair-use applies.
 */

import type { FoodItem, FoodServing } from '@/data/foods';

const ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';

interface OFFNutriments {
  'energy-kcal_100g'?: number;
  energy_100g?: number; // some products report kJ here
  'energy-kj_100g'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  fiber_100g?: number;
}

interface OFFProduct {
  product_name?: string;
  generic_name?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: OFFNutriments;
  code?: string;
  image_small_url?: string;
}

interface OFFResponse {
  status: number; // 1 = found, 0 = not found
  status_verbose?: string;
  product?: OFFProduct;
}

const KJ_PER_KCAL = 4.184;

function kcalPer100g(n: OFFNutriments | undefined): number {
  if (!n) return 0;
  if (typeof n['energy-kcal_100g'] === 'number') return n['energy-kcal_100g'];
  if (typeof n['energy-kj_100g'] === 'number') return n['energy-kj_100g'] / KJ_PER_KCAL;
  if (typeof n.energy_100g === 'number') {
    // `energy_100g` is kJ in newer OFF data, kcal in older — heuristic on magnitude.
    return n.energy_100g > 50 && n.energy_100g < 1000 ? n.energy_100g / KJ_PER_KCAL : n.energy_100g;
  }
  return 0;
}

function inferQuantityG(servingSize: string | undefined): number {
  if (!servingSize) return 100;
  const m = servingSize.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (m) {
    const n = parseFloat(m[1]!);
    if (Number.isFinite(n) && n > 0 && n < 2000) return Math.round(n);
  }
  // Fall back to 100g — the data is per-100g so this never produces wrong macros.
  return 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export interface OffLookupResult {
  item: FoodItem;
  imageUrl?: string;
}

/**
 * Look up a barcode via Open Food Facts. Returns null on miss or on
 * incomplete data (no calories at all). Throws on network/parse error so
 * the caller can show a clear message.
 */
export async function lookupBarcode(rawCode: string): Promise<OffLookupResult | null> {
  const code = rawCode.replace(/[^\d]/g, '');
  if (code.length < 6 || code.length > 14) {
    throw new Error('Barcode must be 6–14 digits.');
  }

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}/${code}.json`);
  } catch {
    throw new Error('Could not reach Open Food Facts. Check your connection.');
  }
  if (!res.ok) throw new Error(`Open Food Facts ${res.status}`);

  const json = (await res.json()) as OFFResponse;
  if (json.status !== 1 || !json.product) return null;

  const p = json.product;
  const calories100 = kcalPer100g(p.nutriments);
  if (calories100 < 1) return null; // No usable nutrition data.

  const quantityG = inferQuantityG(p.serving_size);
  const scale = quantityG / 100;
  const round = (v: number | undefined) => round1((v ?? 0) * scale);

  const displayName = [p.product_name, p.brands ? `(${p.brands.split(',')[0]!.trim()})` : null]
    .filter(Boolean)
    .join(' ')
    .trim() || p.generic_name || `Barcode ${code}`;

  const defaultServing: FoodServing = {
    label: p.serving_size?.trim() || (quantityG === 100 ? '100g' : `${quantityG}g`),
    quantityG,
    calories: Math.round(calories100 * scale),
    protein: round(p.nutriments?.proteins_100g),
    carbs: round(p.nutriments?.carbohydrates_100g),
    fat: round(p.nutriments?.fat_100g),
  };
  const fiber = round(p.nutriments?.fiber_100g);
  if (fiber > 0) defaultServing.fiber = fiber;

  const item: FoodItem = {
    id: `off-${code}`,
    name: displayName,
    category: 'other', // OFF categories are too granular to map cleanly; "other" is honest
    defaultServing,
    source: 'open-food-facts',
  };

  return { item, imageUrl: p.image_small_url };
}
