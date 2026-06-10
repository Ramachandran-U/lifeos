import { Confetti, CannonConfetti } from 'react-native-fast-confetti';
import { presetLifetimeMs } from '@/celebration/presets';
import type { CelebrationRendererProps } from '@/celebration/types';
import { useEffect, useRef } from 'react';

/**
 * Skia-backed epic renderer (react-native-fast-confetti). Loaded ONLY via
 * lazySkia's dynamic import — never import this module statically, or the
 * whole Skia dependency tree lands in the web entry bundle.
 *
 * One Skia canvas per beat, unmounted when the queue advances — keeping the
 * app inside the 16-WebGL-context browser budget (exactly one celebration
 * plays at a time by construction of the queue).
 */
export function SkiaConfetti({ preset, palette, onDone }: CelebrationRendererProps) {
  // onAnimationEnd is the primary completion signal; the token-derived
  // lifetime (+ generous 2x tail) is a watchdog so a missed callback (tab
  // backgrounded mid-fall on web) can never wedge the celebration queue.
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  useEffect(() => {
    const t = setTimeout(finish, presetLifetimeMs(preset) * 2);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (preset.renderer === 'confettiCannon') {
    return (
      <CannonConfetti colors={palette} fadeOutOnEnd onAnimationEnd={finish}>
        <CannonConfetti.Origin position="bottom-left" count={Math.floor(preset.particleCount / 2)} />
        <CannonConfetti.Origin position="bottom-right" count={Math.ceil(preset.particleCount / 2)} />
      </CannonConfetti>
    );
  }

  return (
    <Confetti
      count={preset.particleCount}
      colors={palette}
      fadeOutOnEnd
      onAnimationEnd={finish}
    />
  );
}
