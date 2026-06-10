/**
 * Single lazy entry for BOTH Skia renderers.
 *
 * lazySkia must dynamic-import exactly ONE module for all Skia-backed
 * rendering: two separate `import()`s (SkiaConfetti + SkiaBurst) make Metro
 * treat react-native-fast-confetti and the Skia JS API as "shared between
 * async chunks" and hoist them into a `__common` chunk that index.html loads
 * AT BOOT — silently shipping ~0.5 MB of Skia to every visitor with the flag
 * off (caught by the wave's boot-network probe). One import → one chunk →
 * nothing shared → nothing hoisted.
 */
export { SkiaConfetti } from './SkiaConfetti';
export { SkiaBurst } from './SkiaBurst';
