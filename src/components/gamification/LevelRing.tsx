// ─── LevelRing ───────────────────────────────────────────────────────────────
// Large circular ring that shows the user's current level + XP progress in a
// single glance. Used on the Rewards hero band at 180px.

import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { xpProgressInLevel } from '@/utils/gamification';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface LevelRingProps {
  xp: number;
  size?: number;
  showLabel?: boolean;
}

export function LevelRing({ xp, size = 80, showLabel = true }: LevelRingProps) {
  const c = useColors();
  const { level, pct } = xpProgressInLevel(xp);
  const sw = size * 0.085;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;

  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withTiming(pct, {
      duration: 1200,
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
    });
  }, [pct, anim]);

  const animatedProps = useAnimatedProps(() => {
    const dash = circ * anim.value;
    return {
      strokeDasharray: `${dash} ${circ - dash}`,
    } as { strokeDasharray: string };
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg
        width={size}
        height={size}
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={c.border}
          strokeWidth={sw}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={c.primary}
          strokeWidth={sw}
          strokeLinecap="round"
          animatedProps={animatedProps}
        />
      </Svg>
      {showLabel && (
        <View style={styles.labelWrap} pointerEvents="none">
          <Text
            style={[
              styles.level,
              {
                color: c.textPrimary,
                fontSize: size * 0.28,
                fontFamily: fonts.display,
              },
            ]}
          >
            {level}
          </Text>
          <Text
            style={[
              styles.sub,
              {
                color: c.textMuted,
                fontSize: size * 0.13,
                fontFamily: fonts.body,
              },
            ]}
          >
            LVL
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  labelWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  level: {
    fontWeight: '800',
    lineHeight: undefined,
  },
  sub: {
    letterSpacing: 1,
  },
});
