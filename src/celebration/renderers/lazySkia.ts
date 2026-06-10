import type { ComponentType } from 'react';
import { ensureSkia } from '@/celebration/ensureSkia';
import type { CelebrationRendererProps } from '@/celebration/types';

/**
 * Lazy loader for the Skia-backed renderers. The dynamic `import()` calls are
 * the ONLY references to SkiaConfetti/SkiaBurst in the app, so Metro splits
 * them (plus @shopify/react-native-skia + react-native-fast-confetti) into an
 * async web chunk that never loads at boot.
 *
 * State machine: idle → loading → ready | failed. `failed` is terminal for
 * the session — Expo Go (no native Skia), a WASM 404, or an old browser all
 * land here once, and every later beat renders the Reanimated fallback
 * without re-trying a load that cannot succeed.
 */

export type SkiaLoadState = 'idle' | 'loading' | 'ready' | 'failed';

export interface SkiaRenderers {
  SkiaConfetti: ComponentType<CelebrationRendererProps>;
  SkiaBurst: ComponentType<CelebrationRendererProps>;
}

let state: SkiaLoadState = 'idle';
let renderers: SkiaRenderers | null = null;
const listeners = new Set<() => void>();

export function getSkiaLoadState(): SkiaLoadState {
  return state;
}

export function getSkiaRenderers(): SkiaRenderers | null {
  return renderers;
}

/** Subscribe to load-state changes (useSyncExternalStore-compatible). */
export function subscribeSkiaLoad(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Kick off the load once. Safe to call on every beat — later calls no-op. */
export function beginSkiaLoad(): void {
  if (state !== 'idle') return;
  state = 'loading';
  void (async () => {
    const ok = await ensureSkia();
    if (!ok) throw new Error('skia unavailable');
    // ONE dynamic import, shared with lazyCharts — see src/skia/bundle.ts for
    // why every Skia consumer must enter through the same module.
    const mod = await import('@/skia/bundle');
    renderers = { SkiaConfetti: mod.SkiaConfetti, SkiaBurst: mod.SkiaBurst };
    state = 'ready';
  })()
    .catch(() => {
      state = 'failed';
    })
    .finally(() => {
      listeners.forEach((l) => l());
    });
}

/** Test seam. */
export function __resetSkiaLoadForTests(): void {
  state = 'idle';
  renderers = null;
  listeners.clear();
}
