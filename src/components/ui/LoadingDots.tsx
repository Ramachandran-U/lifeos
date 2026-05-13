import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

interface LoadingDotsProps {
  color?: string;
  size?: number;
}

function Dot({ color, size, delay }: { color: string; size: number; delay: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.3, { duration: 400 }),
        ),
        -1,
      ),
    );
  }, [opacity, delay]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

export function LoadingDots({ color, size = 10 }: LoadingDotsProps) {
  const c = useColors();
  const dotColor = color ?? c.primary;
  return (
    <View style={styles.container}>
      <Dot color={dotColor} size={size} delay={0} />
      <Dot color={dotColor} size={size} delay={200} />
      <Dot color={dotColor} size={size} delay={400} />
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
