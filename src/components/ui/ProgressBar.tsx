import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useColors } from '@/theme/colors';
import { TIMING } from '@/theme/motion';

interface ProgressBarProps {
  value: number;
  color?: string;
  height?: number;
}

// Ink + Signal: progress is a SOLID hue fill on the neutral `track` token —
// gradients are deleted (Manifesto P3: color is meaning, never decoration).
export function ProgressBar({ value, color, height = 8 }: ProgressBarProps) {
  const c = useColors();
  const fill = color ?? c.primary;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(Math.min(Math.max(value, 0), 100), {
      duration: TIMING.slow,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: c.track }]}>
      <Animated.View
        style={[
          styles.fill,
          { borderRadius: height / 2, backgroundColor: fill },
          fillStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    height: '100%',
    overflow: 'hidden',
  },
});
