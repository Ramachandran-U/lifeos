import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { CelebrationBurst } from '@/components/gamification/CelebrationBurst';
import { Confetti } from '@/components/shared/Confetti';
import { presetLifetimeMs } from '@/celebration/presets';
import type { CelebrationRendererProps } from '@/celebration/types';

/**
 * The PERMANENT fallback renderer — pure Reanimated, zero native deps, works
 * everywhere (Expo Go, web before CanvasKit loads, Skia load failures). Wraps
 * the two celebration primitives that already shipped: CelebrationBurst
 * (radial burst) and Confetti (full-screen fall).
 *
 * Never delete this in favour of Skia-only: it is the reduce-risk floor the
 * celebration engine degrades to by design.
 */
export function ReanimatedBurst({ event, preset, palette, onDone }: CelebrationRendererProps) {
  const isBurst = preset.renderer === 'burst';

  // CelebrationBurst has no completion callback (it's a fire-and-forget
  // mount), so the host queue advances on the preset's token-derived
  // lifetime instead. Confetti reports its own completion below.
  useEffect(() => {
    if (!isBurst) return;
    const t = setTimeout(onDone, presetLifetimeMs(preset));
    return () => clearTimeout(t);
  }, [isBurst, preset, onDone]);

  if (isBurst) {
    return (
      <View pointerEvents="none" style={styles.fill}>
        <CelebrationBurst palette={palette} count={preset.particleCount} size={7} originTop={140} />
      </View>
    );
  }

  // confettiFall / confettiCannon both degrade to the falling sheet — the
  // cannon shape is a Skia-only flourish.
  return <Confetti onDone={onDone} />;
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
});
