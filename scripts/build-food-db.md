# Expanding the bundled food database

Today's ship: ~60 hand-curated Indian + global staples in
[`src/data/foods/seed.ts`](../src/data/foods/seed.ts) marked
`source: 'curated-seed'`. Good enough to make the food logger usable
out of the box without typing macros.

When you're ready to expand to the full open-data set:

## Sources

| Dataset | Items | License | Best for |
|---------|-------|---------|----------|
| **[IFCT 2017](https://github.com/ifct2017/ifct2017)** (NIN, Govt. of India) | 542 raw foods | Research/educational; commercial use needs NIN permission | Whole foods, regional Indian items |
| **[Indian Nutrient Databank (INDB)](https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-)** | 1,095 ingredients + 1,014 recipes | See repo LICENSE | Composite Indian recipes (biryani, dal makhani, etc.) |
| **[USDA FoodData Central](https://fdc.nal.usda.gov/)** | 380K+ foods | Public domain | Global whole foods, branded items |
| **[Open Food Facts](https://world.openfoodfacts.org/)** | 3M+ packaged products | ODbL (attribution + share-alike for derived DBs) | Barcode-scannable packaged goods |

## Build pipeline (sketch — not yet implemented)

```js
// scripts/build-food-db.js  (Node script — does not exist yet)
//
// 1. Pull IFCT 2017 + INDB JSON from their GitHub repos
// 2. For each entry, project into FoodItem shape (src/data/foods/types.ts)
// 3. Pick a sensible default serving (200g for curries, 1 piece for breads, etc.)
// 4. Generate aliases (singular/plural, regional spellings)
// 5. Dedupe by normalized name
// 6. Write src/data/foods/seed.ts with the merged array
//
// One-shot — re-run only when you want a fresh import.
```

## Runtime considerations after expansion

- **Bundle size:** 2,600 items at ~250 bytes each ≈ 650 KB. Acceptable for
  web but worth checking the Metro export for native — split by category
  via dynamic import if it becomes a problem.
- **Search performance:** the current [`searchFoods`](../src/utils/foodSearch.ts) is O(N)
  per keystroke. Fine up to ~2k items. Past that, build an inverted
  index at module load or swap for `fuse.js`.
- **Licensing:** keep `source` on each item — the UI uses it to render a
  trust badge ("IFCT-verified", "USDA", or "approximate"). For
  commercial release, IFCT data needs NIN sign-off.

## Future-proof: API fallback for misses

When the bundled DB misses a query, the next step is:

1. **Open Food Facts** for barcode scans (already free, no key needed)
2. **USDA FoodData Central** for global whole foods not in IFCT
3. **AI photo recognition** (existing `recogniseFood`) as last resort

The AI photo flow should also be refactored to do **identify-then-lookup**:
let the model name the dish, then look up macros in the bundled DB.
Today's `recogniseFood` asks the model to *also* estimate macros, which
it consistently undershoots by 20-40%.
