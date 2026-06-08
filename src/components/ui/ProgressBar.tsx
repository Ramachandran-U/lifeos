import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { useColors } from '@/theme/colors';

interface ProgressBarProps {
  value: number;
  color?: string;
  /** Two-stop gradient [from, to] rendered left→right over the fill. When
   *  omitted the bar uses `color` as a solid fill (backwards-compatible). */
  gradientColors?: readonly [string, string];
  height?: number;
}

export function ProgressBar({ value, color, gradientColors, height = 8 }: ProgressBarProps) {
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
          {
            borderRadius: height / 2,
            // When gradient is present, the LinearGradient child provides the colour.
            backgroundColor: gradientColors ? 'transparent' : fill,
          },
          fillStyle,
        ]}
      >
        {gradientColors && (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        )}
      </Animated.View>
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
