// ─── AvatarRing ──────────────────────────────────────────────────────────────
// Circular level ring with user initials in the centre. Animates the arc fill
// from 0 → xp% on mount (900ms cubic-bezier).

import { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
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

interface AvatarRingProps {
  xp: number;
  initials: string;
  size?: number;
}

export function AvatarRing({ xp, initials, size = 80 }: AvatarRingProps) {
  const c = useColors();
  const { level, pct } = xpProgressInLevel(xp);
  const sw = size * 0.075;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;

  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withTiming(pct, {
      duration: 900,
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
      <View
        style={[
          styles.inner,
          {
            top: sw,
            left: sw,
            width: size - sw * 2,
            height: size - sw * 2,
            backgroundColor: c.primary,
          },
        ]}
      >
        <Text
          style={[
            styles.initials,
            { fontSize: size * 0.22, fontFamily: fonts.display },
          ]}
        >
          {initials}
        </Text>
        <Text
          style={[
            styles.level,
            { fontSize: size * 0.11, fontFamily: fonts.body },
          ]}
        >
          Lv{level}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inner: {
    position: 'absolute',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '800',
    lineHeight: undefined,
  },
  level: {
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
});
