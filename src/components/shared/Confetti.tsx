/**
 * Lightweight confetti burst — no native dependency. ~28 Reanimated particles
 * fall + drift + fade over ~2s, then the component reports done so the parent
 * can unmount it. Honors reduce-motion (renders nothing when motion is off).
 */
import { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { MOTION_BUDGET, useMotionScale } from '@/theme/motion';

const COUNT = 28;
const DURATION = MOTION_BUDGET.celebrationFall;

interface Props {
  onDone?: () => void;
}

function Particle({ index, color, onLast }: { index: number; color: string; onLast?: () => void }) {
  const { width, height } = Dimensions.get('window');
  const startX = useMemo(() => Math.random() * width, [width]);
  const drift = useMemo(() => (Math.random() - 0.5) * 160, []);
  const delay = useMemo(() => Math.random() * 250, []);
  const size = useMemo(() => 6 + Math.random() * 8, []);
  const spin = useMemo(() => (Math.random() - 0.5) * 720, []);

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished && onLast) runOnJS(onLast)();
      }),
    );
  }, [progress, delay, onLast]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: drift * progress.value },
      { translateY: (height * 0.9) * progress.value },
      { rotate: `${spin * progress.value}deg` },
    ],
    opacity: 1 - progress.value * progress.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', top: -20, left: startX, width: size, height: size, backgroundColor: color, borderRadius: 2 },
        style,
      ]}
    />
  );
}

export function Confetti({ onDone }: Props) {
  const c = useColors();
  const motionScale = useMotionScale();
  const palette = [c.goal, c.health, c.finance, c.career, c.social, c.polymath, c.xp];
  const reduceMotion = motionScale === 0;

  // Reduce-motion: skip the animation but still let the flow continue. Hook is
  // always called (no conditional-hook violation); it just no-ops when motion
  // is on, since reduceMotion is false then.
  useEffect(() => {
    if (reduceMotion) onDone?.();
  }, [reduceMotion, onDone]);

  if (reduceMotion) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="legacy-confetti">
      {Array.from({ length: COUNT }).map((_, i) => (
        <Particle
          key={i}
          index={i}
          color={palette[i % palette.length]}
          onLast={i === COUNT - 1 ? onDone : undefined}
        />
      ))}
    </View>
  );
}
