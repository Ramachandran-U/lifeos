import { useEffect, useState } from 'react';
import { useMotionScale } from '@/theme/motion';

interface Options {
  /** Only rotate while true — pass `!value` so it pauses once the user types. */
  active?: boolean;
  /** Dwell time per phrase, in ms. Default 2000 — fast enough to show variety
   * before the user starts typing, slow enough to read. */
  intervalMs?: number;
}

/**
 * Cycles through `phrases`, returning the current one and advancing on an
 * interval. Rotation pauses when `active` is false (e.g. the field has a value)
 * and is fully disabled when the user prefers reduced motion
 * (`useMotionScale() === 0`) — in that case the first phrase is shown statically.
 *
 * Only `.length` of `phrases` is tracked, so passing an inline array literal is
 * safe and won't churn the interval on every render.
 */
export function useRotatingPlaceholder(
  phrases: string[],
  { active = true, intervalMs = 2000 }: Options = {},
): string {
  const motionScale = useMotionScale();
  const [index, setIndex] = useState(0);
  const count = phrases.length;

  useEffect(() => {
    if (!active || motionScale === 0 || count <= 1) {
      setIndex(0);
      return;
    }
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, motionScale, count, intervalMs]);

  if (count === 0) return '';
  return phrases[index % count] ?? phrases[0];
}
