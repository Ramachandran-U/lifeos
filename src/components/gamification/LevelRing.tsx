import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { TIMING } from '@/theme/motion';
import { Body, Caption } from '@/components/ui/Typography';
import { xpProgressInLevel } from '@/utils/gamification';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  xp: number;
  size?: number;
  showLabel?: boolean;
  ringColor?: string;
}

export function LevelRing({ xp, size = 80, showLabel = true, ringColor }: Props) {
  const c = useColors();
  const { level, pct } = xpProgressInLevel(xp);
  const sw = size * 0.085;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(pct, { duration: TIMING.epic, easing: Easing.out(Easing.cubic) });
  }, [pct, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: [circ * progress.value, circ - circ * progress.value].join(' '),
  }));

  const stroke = ringColor ?? c.primary;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.border} strokeWidth={sw} />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
          animatedProps={animatedProps}
        />
      </Svg>
      {showLabel && (
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.center}>
            <Body style={{ fontFamily: fonts.heading, fontSize: size * 0.28, color: c.textPrimary, lineHeight: size * 0.3 }}>{level}</Body>
            <Caption style={{ fontSize: Math.max(9, size * 0.13), color: c.textMuted, letterSpacing: 1 }}>LVL</Caption>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
