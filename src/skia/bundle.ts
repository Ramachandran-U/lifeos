/**
 * THE single Skia heavy bundle — every lazily-loaded Skia consumer in the app
 * is re-exported from this one module, and every loader (lazySkia for the
 * celebration engine, lazyCharts for victory-native) dynamic-imports THIS
 * module and nothing else.
 *
 * Why so strict: Metro hoists modules shared between two DIFFERENT async
 * chunks into a `__common` chunk that index.html loads AT BOOT. It happened
 * twice — first SkiaConfetti+SkiaBurst as separate imports (W4 fix), then
 * skiaRenderers+victoryImpl (W5) — each time silently shipping ~0.5 MB of
 * Skia to every visitor with all flags off. One shared import target means
 * one chunk and nothing to hoist; the boot-network probe (tmp/
 * boot-network-check.mjs) guards the contract per wave.
 *
 * Adding a new Skia-backed feature? Re-export it HERE and import it through
 * a loader that targets this module — never add a second import() of
 * anything Skia-flavoured.
 */
export { SkiaConfetti } from '@/celebration/renderers/SkiaConfetti';
export { SkiaBurst } from '@/celebration/renderers/SkiaBurst';
export { XpHistoryImpl, TrendImpl, BreakdownImpl } from '@/components/charts/victoryImpl';
