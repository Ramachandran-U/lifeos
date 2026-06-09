import { Platform } from 'react-native';

/**
 * Lazy CanvasKit bootstrap (web) / availability probe (native).
 *
 * BOOT-COST CONTRACT: nothing in this file — and nothing it imports — may
 * touch @shopify/react-native-skia statically. The WASM (~7 MB, served from
 * /canvaskit.wasm by scripts/copy-canvaskit.js) is fetched only when the
 * first standard/epic celebration beat fires with the celebrationEngine flag
 * on. The Cloudflare Pages entry bundle must stay byte-stable when the flag
 * is off — verified by the wave's web smoke (no canvaskit request at boot).
 *
 * Resolves `false` (never throws) when Skia can't load — Expo Go (no native
 * module), WASM fetch failure, unsupported browser — and the celebration
 * engine stays on the ReanimatedBurst fallback permanently for the session.
 */

let pending: Promise<boolean> | null = null;

export function ensureSkia(): Promise<boolean> {
  if (!pending) pending = load().catch(() => false);
  return pending;
}

async function load(): Promise<boolean> {
  if (Platform.OS !== 'web') {
    // Native: the JSI bindings either exist (dev-client / EAS build) or the
    // module throws on import — probed by the dynamic import in lazySkia.
    return true;
  }
  const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web');
  await LoadSkiaWeb({ locateFile: (file: string) => `/${file}` });
  return true;
}

/** Test seam — reset the memoized load so failure paths can be exercised. */
export function __resetEnsureSkiaForTests(): void {
  pending = null;
}
