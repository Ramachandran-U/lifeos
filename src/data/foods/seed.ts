/**
 * Seed food database — ~60 common Indian + global foods.
 *
 * Hand-curated approximations sourced from public IFCT 2017 / USDA / common
 * package labels. Marked `source: 'curated-seed'` so the trust indicator
 * makes the approximation visible to users.
 *
 * Replace this file with the output of `scripts/build-food-db.js` once you
 * import the full IFCT/INDB datasets — the array shape is stable.
 *
 * Per-serving macros (not per-100g) because real-world food logging is
 * "I ate 1 bowl" not "I ate 173 grams". Each entry includes its quantityG
 * so the macros scale linearly if the user picks a different amount.
 */

import type { FoodItem } from './types';

const seed: FoodItem[] = [
  // ─── Rice & grains ────────────────────────────────────────────────────────
  {
    id: 'basmati-rice-cooked-1-bowl',
    name: 'Basmati rice (cooked)',
    aliases: ['white rice', 'plain rice', 'chawal', 'steamed rice'],
    category: 'rice',
    defaultServing: { label: '1 bowl', quantityG: 150, calories: 195, protein: 4, carbs: 43, fat: 0.5, fiber: 0.6 },
    source: 'curated-seed',
  },
  {
    id: 'brown-rice-cooked-1-bowl',
    name: 'Brown rice (cooked)',
    aliases: ['whole grain rice'],
    category: 'rice',
    defaultServing: { label: '1 bowl', quantityG: 150, calories: 165, protein: 4, carbs: 34, fat: 1.5, fiber: 2.5 },
    source: 'curated-seed',
  },
  {
    id: 'vegetable-biryani-1-plate',
    name: 'Vegetable biryani',
    aliases: ['veg biryani', 'biriyani', 'biriani'],
    category: 'rice',
    defaultServing: { label: '1 plate', quantityG: 200, calories: 350, protein: 7, carbs: 50, fat: 13, fiber: 4 },
    source: 'curated-seed',
  },
  {
    id: 'chicken-biryani-1-plate',
    name: 'Chicken biryani',
    aliases: ['murgh biryani'],
    category: 'rice',
    defaultServing: { label: '1 plate', quantityG: 250, calories: 460, protein: 22, carbs: 50, fat: 18 },
    source: 'curated-seed',
  },
  {
    id: 'jeera-rice-1-bowl',
    name: 'Jeera rice',
    aliases: ['cumin rice'],
    category: 'rice',
    defaultServing: { label: '1 bowl', quantityG: 150, calories: 220, protein: 4, carbs: 42, fat: 4 },
    source: 'curated-seed',
  },

  // ─── Breads ───────────────────────────────────────────────────────────────
  {
    id: 'roti-chapati-1-piece',
    name: 'Roti / Chapati',
    aliases: ['phulka', 'chapathi', 'wheat roti'],
    category: 'bread',
    defaultServing: { label: '1 piece', quantityG: 40, calories: 100, protein: 3, carbs: 18, fat: 1.5, fiber: 2 },
    source: 'curated-seed',
  },
  {
    id: 'naan-plain-1-piece',
    name: 'Naan (plain)',
    aliases: ['butter naan'],
    category: 'bread',
    defaultServing: { label: '1 piece', quantityG: 90, calories: 260, protein: 9, carbs: 45, fat: 5 },
    source: 'curated-seed',
  },
  {
    id: 'paratha-plain-1-piece',
    name: 'Paratha (plain)',
    aliases: ['parantha', 'porotta'],
    category: 'bread',
    defaultServing: { label: '1 piece', quantityG: 60, calories: 200, protein: 4, carbs: 28, fat: 8 },
    source: 'curated-seed',
  },
  {
    id: 'aloo-paratha-1-piece',
    name: 'Aloo paratha',
    aliases: ['potato paratha'],
    category: 'bread',
    defaultServing: { label: '1 piece', quantityG: 120, calories: 290, protein: 6, carbs: 40, fat: 12 },
    source: 'curated-seed',
  },
  {
    id: 'puri-1-piece',
    name: 'Puri',
    aliases: ['poori'],
    category: 'bread',
    defaultServing: { label: '1 piece', quantityG: 30, calories: 130, protein: 2, carbs: 14, fat: 7 },
    source: 'curated-seed',
  },

  // ─── Dals ─────────────────────────────────────────────────────────────────
  {
    id: 'dal-tadka-1-bowl',
    name: 'Dal tadka',
    aliases: ['dal fry', 'tadka dal', 'yellow dal', 'arhar dal'],
    category: 'dal',
    defaultServing: { label: '1 bowl', quantityG: 150, calories: 195, protein: 10, carbs: 27, fat: 5, fiber: 6 },
    source: 'curated-seed',
  },
  {
    id: 'dal-makhani-1-bowl',
    name: 'Dal makhani',
    aliases: ['dal makhni', 'kali dal'],
    category: 'dal',
    defaultServing: { label: '1 bowl', quantityG: 150, calories: 290, protein: 11, carbs: 28, fat: 14, fiber: 7 },
    source: 'curated-seed',
  },
  {
    id: 'sambar-1-bowl',
    name: 'Sambar',
    aliases: ['sambhar'],
    category: 'dal',
    defaultServing: { label: '1 bowl', quantityG: 200, calories: 140, protein: 7, carbs: 22, fat: 3, fiber: 5 },
    source: 'curated-seed',
  },
  {
    id: 'rajma-1-bowl',
    name: 'Rajma',
    aliases: ['kidney beans curry'],
    category: 'dal',
    defaultServing: { label: '1 bowl', quantityG: 200, calories: 250, protein: 12, carbs: 30, fat: 8, fiber: 9 },
    source: 'curated-seed',
  },
  {
    id: 'chana-masala-1-bowl',
    name: 'Chana masala',
    aliases: ['chole', 'chickpea curry', 'channa masala'],
    category: 'dal',
    defaultServing: { label: '1 bowl', quantityG: 200, calories: 290, protein: 12, carbs: 34, fat: 11, fiber: 9 },
    source: 'curated-seed',
  },

  // ─── Vegetable curries ────────────────────────────────────────────────────
  {
    id: 'aloo-gobi-1-bowl',
    name: 'Aloo gobi',
    aliases: ['potato cauliflower'],
    category: 'curry-veg',
    defaultServing: { label: '1 bowl', quantityG: 150, calories: 180, protein: 4, carbs: 22, fat: 9, fiber: 5 },
    source: 'curated-seed',
  },
  {
    id: 'palak-paneer-1-bowl',
    name: 'Palak paneer',
    aliases: ['saag paneer', 'spinach paneer'],
    category: 'curry-veg',
    defaultServing: { label: '1 bowl', quantityG: 200, calories: 320, protein: 14, carbs: 12, fat: 24 },
    source: 'curated-seed',
  },
  {
    id: 'paneer-butter-masala-1-bowl',
    name: 'Paneer butter masala',
    aliases: ['paneer makhani'],
    category: 'curry-veg',
    defaultServing: { label: '1 bowl', quantityG: 200, calories: 420, protein: 15, carbs: 15, fat: 33 },
    source: 'curated-seed',
  },
  {
    id: 'bhindi-fry-1-bowl',
    name: 'Bhindi fry',
    aliases: ['okra fry', 'lady finger sabzi'],
    category: 'curry-veg',
    defaultServing: { label: '1 bowl', quantityG: 100, calories: 120, protein: 2, carbs: 8, fat: 9, fiber: 4 },
    source: 'curated-seed',
  },
  {
    id: 'mixed-veg-curry-1-bowl',
    name: 'Mixed vegetable curry',
    aliases: ['veg curry', 'mixed sabzi'],
    category: 'curry-veg',
    defaultServing: { label: '1 bowl', quantityG: 150, calories: 160, protein: 4, carbs: 18, fat: 8, fiber: 5 },
    source: 'curated-seed',
  },

  // ─── Meat & chicken ───────────────────────────────────────────────────────
  {
    id: 'butter-chicken-1-bowl',
    name: 'Butter chicken',
    aliases: ['murgh makhani', 'chicken makhani'],
    category: 'curry-meat',
    defaultServing: { label: '1 bowl', quantityG: 200, calories: 440, protein: 26, carbs: 10, fat: 32 },
    source: 'curated-seed',
  },
  {
    id: 'chicken-curry-1-bowl',
    name: 'Chicken curry',
    aliases: ['murgh masala', 'chicken masala'],
    category: 'curry-meat',
    defaultServing: { label: '1 bowl', quantityG: 200, calories: 340, protein: 28, carbs: 8, fat: 22 },
    source: 'curated-seed',
  },
  {
    id: 'grilled-chicken-breast-100g',
    name: 'Grilled chicken breast',
    aliases: ['chicken breast', 'tandoori chicken'],
    category: 'protein',
    defaultServing: { label: '100g', quantityG: 100, calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    source: 'curated-seed',
  },
  {
    id: 'egg-boiled-1-large',
    name: 'Egg (boiled, large)',
    aliases: ['hard boiled egg', 'anda'],
    category: 'protein',
    defaultServing: { label: '1 large', quantityG: 50, calories: 78, protein: 6, carbs: 0.6, fat: 5 },
    source: 'curated-seed',
  },
  {
    id: 'egg-omelette-2-eggs',
    name: 'Egg omelette (2 eggs)',
    aliases: ['anda bhurji', 'masala omelette'],
    category: 'protein',
    defaultServing: { label: '2 eggs', quantityG: 110, calories: 200, protein: 13, carbs: 2, fat: 15 },
    source: 'curated-seed',
  },
  {
    id: 'fish-curry-1-bowl',
    name: 'Fish curry',
    aliases: ['machhi curry'],
    category: 'curry-meat',
    defaultServing: { label: '1 bowl', quantityG: 200, calories: 280, protein: 24, carbs: 8, fat: 17 },
    source: 'curated-seed',
  },

  // ─── South Indian breakfast ───────────────────────────────────────────────
  {
    id: 'idli-2-pieces',
    name: 'Idli (2 pieces)',
    aliases: ['steamed rice cake'],
    category: 'breakfast',
    defaultServing: { label: '2 pieces', quantityG: 100, calories: 130, protein: 4, carbs: 26, fat: 1, fiber: 2 },
    source: 'curated-seed',
  },
  {
    id: 'plain-dosa-1-piece',
    name: 'Plain dosa',
    aliases: ['sada dosa', 'dosai'],
    category: 'breakfast',
    defaultServing: { label: '1 piece', quantityG: 80, calories: 170, protein: 4, carbs: 26, fat: 5, fiber: 1 },
    source: 'curated-seed',
  },
  {
    id: 'masala-dosa-1-piece',
    name: 'Masala dosa',
    aliases: ['mysore masala dosa'],
    category: 'breakfast',
    defaultServing: { label: '1 piece', quantityG: 200, calories: 360, protein: 7, carbs: 50, fat: 14, fiber: 3 },
    source: 'curated-seed',
  },
  {
    id: 'upma-1-bowl',
    name: 'Upma',
    aliases: ['rava upma'],
    category: 'breakfast',
    defaultServing: { label: '1 bowl', quantityG: 200, calories: 280, protein: 7, carbs: 42, fat: 10, fiber: 3 },
    source: 'curated-seed',
  },
  {
    id: 'poha-1-bowl',
    name: 'Poha',
    aliases: ['kanda poha', 'flattened rice'],
    category: 'breakfast',
    defaultServing: { label: '1 bowl', quantityG: 150, calories: 240, protein: 5, carbs: 38, fat: 8, fiber: 2 },
    source: 'curated-seed',
  },
  {
    id: 'paneer-200g',
    name: 'Paneer',
    aliases: ['cottage cheese'],
    category: 'dairy',
    defaultServing: { label: '100g', quantityG: 100, calories: 260, protein: 18, carbs: 6, fat: 20 },
    source: 'curated-seed',
  },

  // ─── Snacks ───────────────────────────────────────────────────────────────
  {
    id: 'samosa-1-piece',
    name: 'Samosa',
    aliases: ['somosa'],
    category: 'snack',
    defaultServing: { label: '1 piece', quantityG: 70, calories: 260, protein: 4, carbs: 28, fat: 15 },
    source: 'curated-seed',
  },
  {
    id: 'vada-pav-1-piece',
    name: 'Vada pav',
    aliases: ['vada pao'],
    category: 'snack',
    defaultServing: { label: '1 piece', quantityG: 120, calories: 290, protein: 7, carbs: 38, fat: 12 },
    source: 'curated-seed',
  },
  {
    id: 'pav-bhaji-1-plate',
    name: 'Pav bhaji',
    category: 'snack',
    defaultServing: { label: '1 plate', quantityG: 300, calories: 440, protein: 10, carbs: 52, fat: 22 },
    source: 'curated-seed',
  },
  {
    id: 'pani-puri-6-pieces',
    name: 'Pani puri (6 pieces)',
    aliases: ['golgappa', 'gol gappe', 'puchka'],
    category: 'snack',
    defaultServing: { label: '6 pieces', quantityG: 120, calories: 180, protein: 3, carbs: 32, fat: 4 },
    source: 'curated-seed',
  },

  // ─── Fruits ───────────────────────────────────────────────────────────────
  { id: 'apple-1-medium', name: 'Apple', aliases: ['seb'], category: 'fruit', defaultServing: { label: '1 medium', quantityG: 180, calories: 95, protein: 0.5, carbs: 25, fat: 0.3, fiber: 4 }, source: 'curated-seed' },
  { id: 'banana-1-medium', name: 'Banana', aliases: ['kela'], category: 'fruit', defaultServing: { label: '1 medium', quantityG: 120, calories: 105, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3 }, source: 'curated-seed' },
  { id: 'orange-1-medium', name: 'Orange', aliases: ['santra'], category: 'fruit', defaultServing: { label: '1 medium', quantityG: 130, calories: 60, protein: 1, carbs: 15, fat: 0.2, fiber: 3 }, source: 'curated-seed' },
  { id: 'mango-1-cup', name: 'Mango (cubed)', aliases: ['aam'], category: 'fruit', defaultServing: { label: '1 cup', quantityG: 165, calories: 100, protein: 1.4, carbs: 25, fat: 0.6, fiber: 3 }, source: 'curated-seed' },
  { id: 'papaya-1-cup', name: 'Papaya (cubed)', aliases: ['papita'], category: 'fruit', defaultServing: { label: '1 cup', quantityG: 145, calories: 60, protein: 1, carbs: 15, fat: 0.4, fiber: 3 }, source: 'curated-seed' },
  { id: 'grapes-1-cup', name: 'Grapes', aliases: ['angur'], category: 'fruit', defaultServing: { label: '1 cup', quantityG: 150, calories: 100, protein: 1, carbs: 27, fat: 0.2, fiber: 1.4 }, source: 'curated-seed' },
  { id: 'watermelon-1-cup', name: 'Watermelon (cubed)', aliases: ['tarbooz'], category: 'fruit', defaultServing: { label: '1 cup', quantityG: 150, calories: 45, protein: 0.9, carbs: 11, fat: 0.2, fiber: 0.6 }, source: 'curated-seed' },

  // ─── Beverages & dairy ────────────────────────────────────────────────────
  { id: 'milk-tea-1-cup', name: 'Milk tea (chai)', aliases: ['chai', 'masala chai'], category: 'beverage', defaultServing: { label: '1 cup', quantityG: 200, calories: 90, protein: 3, carbs: 13, fat: 3 }, source: 'curated-seed' },
  { id: 'black-coffee-1-cup', name: 'Black coffee', aliases: ['kaapi'], category: 'beverage', defaultServing: { label: '1 cup', quantityG: 240, calories: 5, protein: 0.3, carbs: 0, fat: 0 }, source: 'curated-seed' },
  { id: 'filter-coffee-1-cup', name: 'Filter coffee (with milk + sugar)', aliases: ['south indian filter coffee'], category: 'beverage', defaultServing: { label: '1 cup', quantityG: 150, calories: 80, protein: 3, carbs: 12, fat: 2 }, source: 'curated-seed' },
  { id: 'milk-1-cup', name: 'Milk (full cream)', aliases: ['doodh'], category: 'dairy', defaultServing: { label: '1 cup', quantityG: 240, calories: 150, protein: 8, carbs: 12, fat: 8 }, source: 'curated-seed' },
  { id: 'curd-1-cup', name: 'Curd (dahi)', aliases: ['yogurt', 'plain yogurt'], category: 'dairy', defaultServing: { label: '1 cup', quantityG: 200, calories: 120, protein: 7, carbs: 9, fat: 7 }, source: 'curated-seed' },
  { id: 'buttermilk-1-cup', name: 'Buttermilk', aliases: ['chaas'], category: 'beverage', defaultServing: { label: '1 cup', quantityG: 240, calories: 60, protein: 4, carbs: 5, fat: 2.5 }, source: 'curated-seed' },
  { id: 'lassi-sweet-1-cup', name: 'Lassi (sweet)', category: 'beverage', defaultServing: { label: '1 cup', quantityG: 240, calories: 220, protein: 6, carbs: 30, fat: 8 }, source: 'curated-seed' },

  // ─── Sweets ───────────────────────────────────────────────────────────────
  { id: 'gulab-jamun-2-pieces', name: 'Gulab jamun (2 pieces)', category: 'sweet', defaultServing: { label: '2 pieces', quantityG: 80, calories: 300, protein: 4, carbs: 40, fat: 14 }, source: 'curated-seed' },
  { id: 'rasgulla-2-pieces', name: 'Rasgulla (2 pieces)', aliases: ['rasagulla'], category: 'sweet', defaultServing: { label: '2 pieces', quantityG: 100, calories: 180, protein: 4, carbs: 38, fat: 1 }, source: 'curated-seed' },
  { id: 'jalebi-100g', name: 'Jalebi', category: 'sweet', defaultServing: { label: '100g', quantityG: 100, calories: 420, protein: 4, carbs: 60, fat: 18 }, source: 'curated-seed' },

  // ─── Common veg/salad ────────────────────────────────────────────────────
  { id: 'salad-mixed-1-bowl', name: 'Mixed salad (raw)', aliases: ['kachumber'], category: 'vegetable', defaultServing: { label: '1 bowl', quantityG: 150, calories: 35, protein: 1.5, carbs: 7, fat: 0.3, fiber: 3 }, source: 'curated-seed' },
  { id: 'cucumber-100g', name: 'Cucumber', aliases: ['kheera'], category: 'vegetable', defaultServing: { label: '100g', quantityG: 100, calories: 16, protein: 0.7, carbs: 4, fat: 0.1, fiber: 0.5 }, source: 'curated-seed' },
  { id: 'tomato-100g', name: 'Tomato', aliases: ['tamatar'], category: 'vegetable', defaultServing: { label: '100g', quantityG: 100, calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2 }, source: 'curated-seed' },
  { id: 'avocado-1-half', name: 'Avocado (half)', category: 'vegetable', defaultServing: { label: '1 half', quantityG: 100, calories: 160, protein: 2, carbs: 9, fat: 15, fiber: 7 }, source: 'curated-seed' },

  // ─── Quick global add-ons (USDA-derived approximations) ───────────────────
  { id: 'oats-cooked-1-bowl', name: 'Oats (cooked)', aliases: ['oatmeal', 'porridge'], category: 'breakfast', defaultServing: { label: '1 bowl', quantityG: 240, calories: 160, protein: 6, carbs: 28, fat: 3, fiber: 4 }, source: 'curated-seed' },
  { id: 'peanut-butter-2-tbsp', name: 'Peanut butter (2 tbsp)', category: 'protein', defaultServing: { label: '2 tbsp', quantityG: 32, calories: 190, protein: 7, carbs: 7, fat: 16, fiber: 2 }, source: 'curated-seed' },
  { id: 'almonds-handful', name: 'Almonds (handful)', aliases: ['badam'], category: 'protein', defaultServing: { label: 'handful (~28g)', quantityG: 28, calories: 165, protein: 6, carbs: 6, fat: 14, fiber: 3.5 }, source: 'curated-seed' },
];

export default seed;
