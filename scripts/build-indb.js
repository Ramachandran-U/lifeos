#!/usr/bin/env node
/**
 * Convert INDB (Indian Nutrient Databank) recipe data into our FoodItem
 * shape. INDB ships two relevant xlsx files; we join them on food_code.
 *
 * Inputs:
 *   tmp/indb-raw.xlsx       — 1,014 recipes with per-recipe nutrient totals
 *   tmp/indb-servings.xlsx  — same rows with serving-count + unit (e.g.
 *                              "tea cup", "plate", "katori", "piece").
 *
 * Per-100g → per-serving conversion: multiply nutrient values by
 * (quantityG / 100). The INDB.xlsx file we read holds per-100g-of-recipe
 * values (the INDB.do script described both per-100g and per-serving
 * columns being generated, but the published xlsx only ships per-100g).
 * Sanity-checked: tea ≈ 16 kcal/100g ✓, biryani ≈ 175 kcal/100g ✓.
 *
 * Serving-size labels come from recipes_servingsize.xlsx; gram weights
 * are best-effort by unit keyword (a "plate" of biryani is heavier than
 * a "plate" of dosa, but absolute gram weight is mostly cosmetic — users
 * adjust the quantity field and macros scale linearly).
 *
 * Output: src/data/foods/indb.json
 *
 * Run: node scripts/build-indb.js
 */

const fs = require('node:fs');
const path = require('node:path');
const xlsx = require('xlsx');

const SRC_RECIPES = path.join(__dirname, '..', 'tmp', 'indb-raw.xlsx');
const SRC_SERVINGS = path.join(__dirname, '..', 'tmp', 'indb-servings.xlsx');
const OUT = path.join(__dirname, '..', 'src', 'data', 'foods', 'indb.json');

/**
 * Best-effort grams-per-serving by unit keyword (lowercase substring,
 * checked in order). Covers the top 40 INDB units; anything not
 * recognized falls back to 100g (cleanest because the data is per-100g).
 */
const SERVING_GRAMS_GUESS = [
  // Liquids
  ['tea cup', 150], ['tall glass', 240], ['large glass', 300],
  ['glass', 240], ['mug', 250], ['cup', 200],
  // Containers
  ['large bowl', 300], ['small bowl', 100], ['katori', 150],
  ['soup bowl', 250], ['curry bowl', 200], ['rice bowl', 200],
  ['bowl', 200], ['dish', 250], ['souffle dish', 250],
  ['plate', 250], ['jar', 250],
  // Implement-sized
  ['tbsp', 15], ['tablespoon', 15], ['tsp', 5], ['teaspoon', 5],
  ['scoop', 60], ['ladle', 100],
  // Hand-sized / named items
  ['sandwich', 120], ['burger', 150], ['pizza slice', 100],
  ['parantha', 80], ['paratha', 80], ['poori', 30], ['puri', 30],
  ['roti', 40], ['chapati', 40], ['naan', 90], ['bhatura', 100],
  ['kulcha', 90], ['dosa', 100], ['idli', 40], ['vada', 50],
  ['cutlet', 70], ['pancake', 60], ['cheela', 60], ['tikki', 60],
  ['samosa', 70], ['triangle', 70], ['pakora', 30],
  ['kebab', 60], ['kabab', 60], ['tikka', 50],
  // Sweets
  ['gulab jamun', 40], ['rasgulla', 50], ['ladoo', 30], ['laddu', 30],
  ['burfi', 30], ['barfi', 30], ['halwa serving', 100],
  ['jalebi', 40], ['cookie', 20], ['biscuit', 15], ['tart', 80],
  // Misc countable
  ['egg', 50], ['piece', 50], ['slice', 50], ['ball', 30],
  // Generic
  ['serving', 100], ['portion', 150],
];

function guessGrams(unit) {
  if (!unit) return 100;
  const u = String(unit).toLowerCase().trim();
  if (!u) return 100;
  for (const [keyword, g] of SERVING_GRAMS_GUESS) {
    if (u.includes(keyword)) return g;
  }
  return 100; // Conservative fallback — matches the data's native per-100g.
}

/** Rough name-based category mapping for the merged DB's category enum. */
function inferCategory(name) {
  const n = name.toLowerCase();
  if (/biryani|biriyani|pulao|fried rice|rice/.test(n)) return 'rice';
  if (/roti|chapati|naan|paratha|paratha|puri|kulcha|bhatura/.test(n)) return 'bread';
  if (/dal|sambar|rasam|kadhi|lentil|chana masala|chole|rajma/.test(n)) return 'dal';
  if (/chicken|mutton|fish|prawn|egg|kebab|meat/.test(n)) return 'curry-meat';
  if (/(paneer|aloo|gobi|baingan|bhindi|sabzi|curry|kofta|saag|palak)/.test(n)) return 'curry-veg';
  if (/idli|dosa|upma|poha|appam|uttapam|breakfast|cereal|oats|oatmeal|porridge/.test(n)) return 'breakfast';
  if (/samosa|pakora|vada|chaat|bhaji|namkeen/.test(n)) return 'snack';
  if (/lassi|tea|coffee|chai|sherbet|panna|juice|smoothie|milkshake/.test(n)) return 'beverage';
  if (/halwa|kheer|payasam|laddu|barfi|jamun|jalebi|rasgulla|kulfi|sweet|gulab/.test(n)) return 'sweet';
  if (/milk|curd|dahi|yogurt|buttermilk|paneer|cheese|ghee/.test(n)) return 'dairy';
  if (/salad|raita|chutney|pickle|achaar/.test(n)) return 'vegetable';
  return 'other';
}

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function round1(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

function main() {
  for (const p of [SRC_RECIPES, SRC_SERVINGS]) {
    if (!fs.existsSync(p)) {
      console.error(`Missing ${p}. Download with:`);
      console.error(`  curl -sL https://raw.githubusercontent.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-/main/$(basename ${p} | sed 's/indb-raw/INDB/; s/indb-servings/recipes_servingsize/') -o ${p}`);
      process.exit(1);
    }
  }

  const recipesWb = xlsx.readFile(SRC_RECIPES);
  const recipes = xlsx.utils.sheet_to_json(recipesWb.Sheets[recipesWb.SheetNames[0]], { defval: null });

  const servingsWb = xlsx.readFile(SRC_SERVINGS);
  const servings = xlsx.utils.sheet_to_json(servingsWb.Sheets[servingsWb.SheetNames[0]], { defval: null });

  // Index servings by recipe_code for the join.
  const byCode = new Map();
  for (const row of servings) {
    if (row.recipe_code) byCode.set(row.recipe_code, row);
  }

  const out = [];
  const seenIds = new Set();
  let skipped = 0;

  for (const r of recipes) {
    const code = r.food_code;
    const name = r.food_name;
    if (!code || !name) {
      skipped++;
      continue;
    }
    const sv = byCode.get(code);
    const kcalPer100g = Number(r.energy_kcal) || 0;
    if (kcalPer100g < 1) {
      skipped++;
      continue;
    }

    const rawUnit = (sv?.servings_unit && String(sv.servings_unit).trim()) || '';
    const quantityG = guessGrams(rawUnit);
    // If we fell back to the generic 100g default, label the serving "100g"
    // (matches the actual quantity); otherwise prefix the unit with "1 ".
    const unitLabel = rawUnit ? `1 ${rawUnit}` : '100g';
    // Scale per-100g → per-serving using the heuristic gram weight.
    const scale = quantityG / 100;
    const perServing = (v) => round1((Number(v) || 0) * scale);

    let id = `indb-${slug(name)}`;
    let n = 2;
    while (seenIds.has(id)) {
      id = `indb-${slug(name)}-${n++}`;
    }
    seenIds.add(id);

    const item = {
      id,
      name,
      category: inferCategory(name),
      defaultServing: {
        label: unitLabel,
        quantityG,
        calories: Math.round(kcalPer100g * scale),
        protein: perServing(r.protein_g),
        carbs: perServing(r.carb_g),
        fat: perServing(r.fat_g),
      },
      source: 'indb-2024',
    };
    const fiber = perServing(r.fibre_g);
    if (fiber > 0) item.defaultServing.fiber = fiber;

    out.push(item);
  }

  out.sort((a, b) => a.name.localeCompare(b.name));

  fs.writeFileSync(OUT, JSON.stringify(out, null, 0) + '\n');
  const bytes = fs.statSync(OUT).size;
  console.log(`Wrote ${out.length} items to ${OUT} (${(bytes / 1024).toFixed(1)} KB)`);
  console.log(`Skipped: ${skipped} entries (missing code/name or zero kcal)`);

  // Category distribution sanity check.
  const cats = {};
  for (const item of out) cats[item.category] = (cats[item.category] || 0) + 1;
  console.log('Categories:', Object.entries(cats).sort((a, b) => b[1] - a[1]));
}

main();
