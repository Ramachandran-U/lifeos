import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { useColors, DOMAIN_GRADIENTS } from '@/theme/colors';

interface Props {
  pct: number;
  color: string;
  /** Two-stop gradient [from, to]. Defaults to the XP gradient token. */
  gradientColors?: readonly [string, string];
  height?: number;
}

export function XpBar({ pct, color, gradientColors = DOMAIN_GRADIENTS.xp, height = 8 }: Props) {
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
      <Animated.View
        style={[
          styles.fill,
          { height, borderRadius: height / 2, backgroundColor: gradientColors ? 'transparent' : color },
          animStyle,
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
  track: { overflow: 'hidden', width: '100%' },
  fill: { overflow: 'hidden' },
});
