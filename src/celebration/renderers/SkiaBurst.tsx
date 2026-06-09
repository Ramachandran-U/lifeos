import { PIConfetti } from 'react-native-fast-confetti';
import { presetLifetimeMs } from '@/celebration/presets';
import type { CelebrationRendererProps } from '@/celebration/types';
import { useEffect, useRef } from 'react';

/**
 * Skia-backed standard-tier renderer — a radial particle burst from the
 * reward-chip area (top-center, matching CelebrationBurst's originTop).
 * Loaded ONLY via lazySkia's dynamic import (see SkiaConfetti for why).
 */
export function SkiaBurst({ preset, palette, onDone }: CelebrationRendererProps) {
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  // Watchdog mirror of SkiaConfetti — a missed onAnimationEnd must never
  // wedge the queue.
  useEffect(() => {
    const t = setTimeout(finish, presetLifetimeMs(preset) * 2);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PIConfetti colors={palette} fadeOutOnEnd onAnimationEnd={finish}>
      <PIConfetti.Origin
        blastPosition="top-center"
        count={preset.particleCount}
        initialSpeed={0.6}
      />
    </PIConfetti>
  );
}
