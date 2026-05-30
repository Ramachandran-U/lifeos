import { useEffect, useState } from 'react';
import { StyleSheet, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { fonts, fontSizes } from '@/theme/typography';
import { useMotionScale } from '@/theme/motion';
import { useRotatingPlaceholder } from '@/hooks/useRotatingPlaceholder';

interface Props {
  /** Hints to cycle through. */
  phrases: string[];
  /** Show + rotate only while true — pass `!value` so it clears once the user types. */
  active: boolean;
  /** Muted placeholder colour (match `placeholderTextColor`). */
  color: string;
  /**
   * Positioning + font overrides. The component is absolutely positioned; the
   * caller supplies `top`/`left` to align it with where the native placeholder
   * would sit, plus any `fontSize`/`fontFamily` to match the input.
   */
  style?: TextStyle | TextStyle[];
  /** Dwell time per phrase, in ms. Default 3200. */
  intervalMs?: number;
}

const FADE_OUT_MS = 180;
const FADE_IN_MS = 240;

/**
 * A drop-in animated stand-in for a `TextInput` placeholder that cross-fades
 * between a list of hints. Render it as a sibling overlaid on a `TextInput`
 * (inside a `position: relative` wrapper) and leave the input's own
 * `placeholder` empty. It pointer-passes-through so taps still focus the input.
 *
 * Honours reduced motion — when motion is off it shows the first hint statically
 * with no animation. See [[useRotatingPlaceholder]].
 */
export function RotatingPlaceholder({ phrases, active, color, style, intervalMs }: Props) {
  const phrase = useRotatingPlaceholder(phrases, { active, intervalMs });
  const motionScale = useMotionScale();
  const opacity = useSharedValue(1);
  const [shown, setShown] = useState(phrase);

  // Phrase changed: fade out, then swap text at the trough and fade back in.
  // The swap is driven by a JS timer (not the reanimated completion callback) so
  // it always fires — on react-native-web the worklet callback can be dropped,
  // which would otherwise leave the placeholder stuck at opacity 0.
  useEffect(() => {
    if (phrase === shown) return;
    if (motionScale === 0) {
      setShown(phrase);
      return;
    }
    opacity.value = withTiming(0, { duration: FADE_OUT_MS, easing: Easing.in(Easing.quad) });
    const t = setTimeout(() => setShown(phrase), FADE_OUT_MS);
    return () => clearTimeout(t);
  }, [phrase, shown, motionScale, opacity]);

  // New text mounted: fade it in (or snap to full opacity when motion is off).
  useEffect(() => {
    if (motionScale === 0) {
      opacity.value = 1;
      return;
    }
    opacity.value = withTiming(1, { duration: FADE_IN_MS, easing: Easing.out(Easing.quad) });
  }, [shown, motionScale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!active || !shown) return null;

  return (
    <Animated.Text
      pointerEvents="none"
      numberOfLines={1}
      style={[styles.base, { color }, style, animatedStyle]}
    >
      {shown}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
  },
});
