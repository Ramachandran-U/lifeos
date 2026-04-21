import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useColors } from '@/theme/colors';

interface Props {
  pct: number;
  color: string;
  height?: number;
}

export function XpBar({ pct, color, height = 8 }: Props) {
  const c = useColors();
  const w = useSharedValue(0);

  useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(1, pct)), {
      duration: 1000,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct, w]);

  const animStyle = useAnimatedStyle(() => ({
    width: `${w.value * 100}%`,
  }));

  return (
    <View style={[styles.track, { backgroundColor: c.border, height, borderRadius: height / 2 }]}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color }, animStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden', width: '100%' },
});
