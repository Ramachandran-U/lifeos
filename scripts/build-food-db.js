#!/usr/bin/env node
/**
 * Convert IFCT 2017 (raw NIN data via the nodef/ifct2017 GitHub repo) into
 * the FoodItem shape consumed by src/data/foods/.
 *
 * Input:  tmp/ifct-raw.csv  (downloaded from
 *         https://raw.githubusercontent.com/nodef/ifct2017/main/compositions/index.csv)
 * Output: src/data/foods/ifct.json
 *
 * Run with:  node scripts/build-food-db.js
 *
 * The conversion picks the columns we actually use (code, name, lang,
 * grup, enerc, fatce, fibtg, choavldf, protcnt) and discards the ~200
 * micronutrient columns we don't surface. Energy is stored in kJ in the
 * source data; we convert to kcal (÷ 4.184). All macros are per 100g.
 *
 * Regional Indian names (Tamil, Telugu, Marathi, etc.) live in the `lang`
 * field under codes like "Tam. xxx" / "Tel. yyy"; we strip the prefix and
 * use the bare names as `aliases` so search hits them naturally.
 *
 * The IFCT 2017 dataset is published under research/educational terms by
 * NIN, Govt. of India. For commercial use, contact NIN.
 */

const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'tmp', 'ifct-raw.csv');
const OUT = path.join(__dirname, '..', 'src', 'data', 'foods', 'ifct.json');

const KJ_PER_KCAL = 4.184;

// IFCT food groups → our FoodItem.category enum.
// IFCT has ~12 groups; we collapse into our coarse categories.
const GROUP_TO_CATEGORY = {
  'Cereals and Millets': 'rice', // grain-ish; most users pick rice anyway
  'Grain Legumes': 'dal',
  'Green Leafy Vegetables': 'vegetable',
  'Other Vegetables': 'vegetable',
  'Roots and Tubers': 'vegetable',
  'Fruits': 'fruit',
  'Fresh Water Fish and Shellfish': 'protein',
  'Marine Fish': 'protein',
  'Marine Shellfish': 'protein',
  'Marine Mollusks': 'protein',
  'Animal Meat': 'protein',
  'Poultry': 'protein',
  'Egg and Egg Products': 'protein',
  'Milk and Milk Products': 'dairy',
  'Edible Oils and Fats': 'other',
  'Mushrooms': 'vegetable',
  'Miscellaneous Foods': 'other',
  'Sugars': 'sweet',
  'Condiments and Spices': 'other',
  'Nuts and Oil Seeds': 'protein',
};

/** Parse one row of CSV — handles quoted fields with commas. */
function parseCsvRow(line) {
  const out = [];
  let i = 0;
  let field = '';
  let inQuotes = false;
  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i += 2;
      } else if (ch === '"') {
        inQuotes = false;
        i += 1;
      } else {
        field += ch;
        i += 1;
      }
    } else if (ch === ',') {
      out.push(field);
      field = '';
      i += 1;
    } else if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  out.push(field);
  return out;
}

/** Slug from a name + code for stable IDs. */
function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * IFCT's `lang` field is a semicolon-separated list like:
 *   "A. Moricha guti; H. Ramdana; Kan. Danthu beeja; Tam. Keerai vidai"
 * The two-letter prefix is a language code (A=Assamese, H=Hindi, etc.).
 * We strip the prefix and keep the bare name; deduplicate; cap to keep
 * the bundle small.
 */
function extractAliases(langField) {
  if (!langField) return undefined;
  const parts = langField
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);
  const aliases = new Set();
  for (const p of parts) {
    // Skip bracketed metadata like "[Place of collection: Chennai]".
    if (p.startsWith('[') || p.endsWith(']')) continue;
    // Strip the "Xxx." prefix (1-5 letters + period + space).
    const m = p.match(/^[A-Za-z]{1,5}\.\s+(.+)$/);
    let bare = (m ? m[1] : p).trim();
    // Drop trailing period and split comma-separated lists into separate aliases.
    bare = bare.replace(/\.$/, '').trim();
    for (const piece of bare.split(',').map((x) => x.trim()).filter(Boolean)) {
      if (piece.length > 1 && piece.length < 40) aliases.add(piece);
    }
  }
  const arr = Array.from(aliases).slice(0, 6); // cap to keep payload small
  return arr.length > 0 ? arr : undefined;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function numOrZero(s) {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Missing ${SRC}. Run:`);
    console.error('  curl -s https://raw.githubusercontent.com/nodef/ifct2017/main/compositions/index.csv -o tmp/ifct-raw.csv');
    process.exit(1);
  }

  const raw = fs.readFileSync(SRC, 'utf8');
  const lines = raw.split(/\r?\n/);
  const header = parseCsvRow(lines[0]);

  const idx = (col) => header.indexOf(col);
  const cName = idx('name');
  const cLang = idx('lang');
  const cGrup = idx('grup');
  const cEnerc = idx('enerc'); // kJ per 100g
  const cFat = idx('fatce'); // g per 100g
  const cFib = idx('fibtg');
  const cCho = idx('choavldf'); // available carbohydrate
  const cProt = idx('protcnt');

  if ([cName, cLang, cGrup, cEnerc, cFat, cCho, cProt].some((i) => i < 0)) {
    console.error('Header mismatch — IFCT CSV schema changed. Manual fix needed.');
    process.exit(1);
  }

  const out = [];
  const seenIds = new Set();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = parseCsvRow(line);
    if (cols.length < header.length / 2) continue; // skip malformed

    const name = cols[cName]?.trim();
    if (!name) continue;

    const energyKj = numOrZero(cols[cEnerc]);
    const calories = Math.round(energyKj / KJ_PER_KCAL);
    if (calories <= 0) continue; // skip entries with no energy data

    const protein = round1(numOrZero(cols[cProt]));
    const carbs = round1(numOrZero(cols[cCho]));
    const fat = round1(numOrZero(cols[cFat]));
    const fiber = round1(numOrZero(cols[cFib]));

    const grup = cols[cGrup]?.trim();
    const category = GROUP_TO_CATEGORY[grup] ?? 'other';

    let id = `ifct-${slug(name)}`;
    let n = 2;
    while (seenIds.has(id)) {
      id = `ifct-${slug(name)}-${n++}`;
    }
    seenIds.add(id);

    const item = {
      id,
      name,
      category,
      defaultServing: {
        label: '100g',
        quantityG: 100,
        calories,
        protein,
        carbs,
        fat,
      },
      source: 'ifct-2017',
    };

    if (fiber > 0) item.defaultServing.fiber = fiber;

    const aliases = extractAliases(cols[cLang]);
    if (aliases) item.aliases = aliases;

    out.push(item);
  }

  // Sort by name for deterministic output (helps git diffs when re-running).
  out.sort((a, b) => a.name.localeCompare(b.name));

  fs.writeFileSync(OUT, JSON.stringify(out, null, 0) + '\n');
  console.log(`Wrote ${out.length} items to ${OUT}`);
  const bytes = fs.statSync(OUT).size;
  console.log(`File size: ${(bytes / 1024).toFixed(1)} KB`);
}

main();
