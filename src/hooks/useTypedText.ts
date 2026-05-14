import { useEffect, useState } from 'react';
import { useMotionScale } from '@/theme/motion';

interface Options {
  /** Reveal rate in characters per second. */
  charsPerSecond?: number;
  /** Delay in ms before typing starts. */
  startDelay?: number;
}

/**
 * Reveals `text` one character at a time at the given rate. When the user
 * has reduced motion enabled (`useMotionScale() === 0`) the full string is
 * delivered immediately so screen readers and impatient users aren't gated
 * on animation.
 */
export function useTypedText(text: string, options: Options = {}): string {
  const { charsPerSecond = 49, startDelay = 0 } = options;
  const motionScale = useMotionScale();
  const [visible, setVisible] = useState(motionScale === 0 ? text : '');

  useEffect(() => {
    if (motionScale === 0) {
      setVisible(text);
      return;
    }
    setVisible('');
    let i = 0;
    const intervalMs = Math.max(1, Math.round(1000 / charsPerSecond));
    let interval: ReturnType<typeof setInterval> | null = null;
    const startTimer = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setVisible(text.slice(0, i));
        if (i >= text.length && interval) {
          clearInterval(interval);
          interval = null;
        }
      }, intervalMs);
    }, startDelay);
    return () => {
      clearTimeout(startTimer);
      if (interval) clearInterval(interval);
    };
  }, [text, charsPerSecond, startDelay, motionScale]);

  return visible;
}
