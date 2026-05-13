import { useEffect, useState } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { radii } from '@/theme/radii';
import { useMotionScale } from '@/theme/motion';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  radius?: number;
  // Aurora rule: only shimmer once we know the wait is real (>= 300ms).
  // If your data resolves faster, render a solid placeholder via this prop.
  delayMs?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({
  width = '100%',
  height = 16,
  radius = radii.hairline,
  delayMs = 300,
  style,
}: SkeletonProps) {
  const c = useColors();
  const [visible, setVisible] = useState(delayMs === 0);
  const motionScale = useMotionScale();
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    if (delayMs === 0) return;
    const t = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  useEffect(() => {
    if (!visible || motionScale === 0) return;
    opacity.value = withRepeat(
      withTiming(0.85, { duration: 900 / motionScale, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [visible, motionScale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!visible) {
    // Solid placeholder before the shimmer kicks in.
    return (
      <View
        style={[
          styles.solid,
          { width: width as number, height, borderRadius: radius, backgroundColor: c.surfaceAlt },
          style,
        ]}
      />
    );
  }
  return (
    <Animated.View
      style={[
        styles.solid,
        { width: width as number, height, borderRadius: radius, backgroundColor: c.surfaceAlt },
        animatedStyle,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  solid: {},
});
