// ─── StreakFlame ─────────────────────────────────────────────────────────────
// 🔥 flame + count, with a subtle scale pulse on increment. Grace used fades
// the whole row to 45% opacity.

import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

type Size = 'sm' | 'md' | 'lg';

interface StreakFlameProps {
  count: number;
  graceUsed?: boolean;
  size?: Size;
}

const SIZE_MAP: Record<Size, { flame: number; text: number }> = {
  sm: { flame: 20, text: 13 },
  md: { flame: 28, text: 16 },
  lg: { flame: 40, text: 22 },
};

export function StreakFlame({ count, graceUsed = false, size = 'md' }: StreakFlameProps) {
  const c = useColors();
  const s = SIZE_MAP[size];
  const scale = useSharedValue(1);
  const prev = useRef(count);

  useEffect(() => {
    if (count > prev.current) {
      scale.value = withSequence(
        withTiming(1.15, { duration: 150 }),
        withTiming(1, { duration: 150 }),
      );
    }
    prev.current = count;
  }, [count, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={[styles.row, { opacity: graceUsed ? 0.45 : 1 }]}>
      <Animated.Text style={[{ fontSize: s.flame, lineHeight: s.flame * 1.1 }, animStyle]}>
        🔥
      </Animated.Text>
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: s.text,
          fontWeight: '800',
          color: c.streak,
        }}
      >
        {count}
      </Text>
      {graceUsed && (
        <Text style={[styles.grace, { color: c.textMuted }]}>grace</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  grace: {
    fontFamily: fonts.body,
    fontSize: 11,
    marginLeft: 2,
  },
});
