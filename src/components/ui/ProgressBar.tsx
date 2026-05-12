import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useColors } from '@/theme/colors';

interface ProgressBarProps {
  value: number;
  color?: string;
  height?: number;
}

export function ProgressBar({ value, color, height = 8 }: ProgressBarProps) {
  const c = useColors();
  const fill = color ?? c.primary;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(Math.min(Math.max(value, 0), 100), {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: c.surface }]}>
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: fill, borderRadius: height / 2 },
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
  },
});
