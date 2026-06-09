import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { isEnabled } from '@/config/flags';
import { useMotionScale } from '@/theme/motion';
import { useColors } from '@/theme/colors';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { useCelebrationStore } from './useCelebrationStore';
import { resolvePreset } from './presets';
import { ReanimatedBurst } from './renderers/ReanimatedBurst';
import {
  beginSkiaLoad,
  getSkiaLoadState,
  getSkiaRenderers,
  subscribeSkiaLoad,
} from './renderers/lazySkia';

/**
 * CelebrationHost (M2) — mounted exactly once in app/_layout.tsx, above the
 * navigator, below the chip/toast/overlay owners. Drains the celebration
 * queue one beat at a time.
 *
 * Gates (all must hold or the host renders nothing and drains silently):
 *   - celebrationEngine compile-time flag
 *   - useMotionScale() > 0 (reduce-motion / motion 'off' collapse to zero)
 *   - usePreferencesStore.gamification !== 'off'
 *
 * Renderer choice: Skia (react-native-fast-confetti) once its lazy chunk +
 * CanvasKit are ready; the pure-Reanimated fallback before that and forever
 * if the load fails. The choice is pinned per-beat (keyed off the event id)
 * so a load finishing mid-fall never swaps renderers under the particles.
 */
export function CelebrationHost() {
  const active = useCelebrationStore((s) => s.active);
  const complete = useCelebrationStore((s) => s.complete);
  const motionScale = useMotionScale();
  const gamification = usePreferencesStore((s) => s.gamification);
  const c = useColors();

  const flagOn = isEnabled('celebrationEngine');
  const gated = !flagOn || motionScale === 0 || gamification === 'off';

  const skiaState = useSyncExternalStore(subscribeSkiaLoad, getSkiaLoadState, getSkiaLoadState);

  // Gated-but-queued beats drain without rendering, so a mid-session
  // preference flip can never wedge the queue (celebrate() already drops new
  // beats while the flag is off; this covers pref/motion changes).
  useEffect(() => {
    if (active && gated) complete();
  }, [active, gated, complete]);

  // First renderable beat kicks the lazy Skia load (web: CanvasKit WASM
  // fetch). Never at boot — this effect can only run once a beat exists.
  useEffect(() => {
    if (active && !gated) beginSkiaLoad();
  }, [active, gated]);

  // Pin the renderer for this beat. `skiaState` is deliberately NOT a dep —
  // the upgrade applies from the next beat onward.
  const pinned = useMemo(() => {
    if (!active) return null;
    const preset = resolvePreset(active);
    if (preset.renderer === 'none') return null;
    const skia = getSkiaLoadState() === 'ready' ? getSkiaRenderers() : null;
    const Renderer = skia
      ? (preset.renderer === 'burst' ? skia.SkiaBurst : skia.SkiaConfetti)
      : ReanimatedBurst;
    return { preset, Renderer };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  // Micro tier never reaches the queue (celebrate drops it), but resolvePreset
  // can still return 'none' defensively — complete those without rendering.
  useEffect(() => {
    if (active && !gated && pinned === null) complete();
  }, [active, gated, pinned, complete]);

  if (!active || gated || !pinned) return null;
  void skiaState; // subscription keeps the host re-rendering as the chunk lands

  // Same theme-indexing idiom as RewardOrchestrator's domain hue lookup.
  const hues = c as Record<string, string>;
  const palette = [
    ...(active.domain && hues[active.domain] ? [hues[active.domain]] : []),
    ...pinned.preset.paletteKeys
      .map((k) => hues[k])
      .filter((v): v is string => typeof v === 'string'),
  ];

  const { Renderer } = pinned;
  return (
    <View pointerEvents="none" style={styles.layer}>
      <Renderer
        key={active.id}
        event={active}
        preset={pinned.preset}
        palette={palette}
        onDone={complete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    // Particle weather sits ABOVE the reward chip (50) but BEHIND the
    // level-up (60) / milestone (61) banners it plays underneath.
    zIndex: 55,
  },
});
