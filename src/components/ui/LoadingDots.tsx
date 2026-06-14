import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { MOTION_BUDGET, useMotionScale } from '@/theme/motion';

interface LoadingDotsProps {
  /**
   * Dot color. Defaults to a NEUTRAL ink tone (`textMuted`). Violet is the
   * brand / AI voice (Guard E) — NOT a generic loading colour, so the default
   * must never be violet. AI/brand surfaces may pass the violet brand token
   * explicitly; a domain screen can pass its own hue (e.g. the health green).
   */
  color?: string;
  size?: number;
}

/**
 * A flowing wave: each dot rises, grows and brightens in turn, then settles —
 * staggered so the motion reads left-to-right and feels alive rather than a flat
 * blink. Each half-cycle sits in the responsive 200–500ms band. Honors the user's
 * reduce-motion / motion-intensity setting (renders static dots when motion is off).
 */
function Dot({ color, size, delay, animate }: {
  color: string;
  size: number;
  delay: number;
  animate: boolean;
}) {
  const t = useSharedValue(0); // 0 = resting (low, small, dim) · 1 = peak of the wave

  useEffect(() => {
    if (!animate) return;
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: MOTION_BUDGET.reveal, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: MOTION_BUDGET.reveal, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      ),
    );
  }, [t, delay, animate]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + t.value * 0.55,
    transform: [
      { translateY: -t.value * size * 0.55 },
      { scale: 0.75 + t.value * 0.37 },
    ],
  }));

  const base = { width: size, height: size, borderRadius: size / 2, backgroundColor: color };
  // Reduce-motion: a calm row of static dots — no rise, no pulse.
  if (!animate) return <View style={[base, { opacity: 0.9 }]} />;
  return <Animated.View style={[base, animatedStyle]} />;
}

export function LoadingDots({ color, size = 10 }: LoadingDotsProps) {
  const c = useColors();
  const animate = useMotionScale() > 0; // 0 ⇒ OS reduce-motion or intensity 'off'
  const dotColor = color ?? c.textMuted;
  return (
    <View style={[styles.container, { minHeight: size * 1.8 }]}>
      <Dot color={dotColor} size={size} delay={0} animate={animate} />
      <Dot color={dotColor} size={size} delay={MOTION_BUDGET.pressFeedback} animate={animate} />
      <Dot color={dotColor} size={size} delay={MOTION_BUDGET.pressFeedback * 2} animate={animate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'center',
  },
});
