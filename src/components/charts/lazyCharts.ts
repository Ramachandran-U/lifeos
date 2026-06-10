import { Platform } from 'react-native';
import type { ComponentType } from 'react';
import type { VictoryChartsModule } from './victoryImpl.types';

/**
 * Lazy loader for the victory-native chart impls (M4) — same single-import
 * state machine as celebration/renderers/lazySkia, for the same reason: ALL
 * victory/Skia chart code must enter through exactly ONE dynamic import, or
 * Metro hoists the shared modules into a boot-loaded __common chunk.
 *
 * Web is 'unavailable' by design for now ("web-pending"): victory-native
 * renders into Skia, and we don't pay the CanvasKit WASM for charts while the
 * static Sparkline fallback communicates the same data. Revisit once the
 * celebration engine has CanvasKit warm anyway.
 */

export type ChartsLoadState = 'idle' | 'loading' | 'ready' | 'unavailable';

let state: ChartsLoadState = Platform.OS === 'web' ? 'unavailable' : 'idle';
let impl: VictoryChartsModule | null = null;
const listeners = new Set<() => void>();

export function getChartsLoadState(): ChartsLoadState {
  return state;
}

export function getChartsImpl(): VictoryChartsModule | null {
  return impl;
}

export function subscribeChartsLoad(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function beginChartsLoad(): void {
  if (state !== 'idle') return;
  state = 'loading';
  // Same import target as lazySkia — src/skia/bundle.ts explains why every
  // Skia consumer must share ONE dynamic import.
  void import('@/skia/bundle')
    .then((m) => {
      impl = { XpHistoryImpl: m.XpHistoryImpl, TrendImpl: m.TrendImpl, BreakdownImpl: m.BreakdownImpl };
      state = 'ready';
    })
    .catch(() => {
      state = 'unavailable'; // Expo Go (no native Skia) or a load failure
    })
    .finally(() => {
      listeners.forEach((l) => l());
    });
}

/** Test seam. */
export function __resetChartsLoadForTests(): void {
  state = Platform.OS === 'web' ? 'unavailable' : 'idle';
  impl = null;
  listeners.clear();
}

export type { ComponentType };
