import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useEffect, useRef } from 'react';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { SPRING } from '@/theme/motion';
import { Body } from './Typography';

interface StreakCounterProps {
  count: number;
}

export function StreakCounter({ count }: StreakCounterProps) {
  const scale = useSharedValue(1);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count > prevCount.current) {
      scale.value = withSequence(
        withSpring(1.3, SPRING.snappy),
        withSpring(1, SPRING.standard),
      );
    }
    prevCount.current = count;
  }, [count, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Body style={styles.flame}>🔥</Body>
      <Body style={styles.count}>{count}</Body>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  flame: {
    fontSize: fontSizes.xl,
  },
  count: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    color: colors.streak,
  },
});
