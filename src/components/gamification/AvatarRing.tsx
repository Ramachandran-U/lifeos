import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { TIMING } from '@/theme/motion';
import { Body, Caption } from '@/components/ui/Typography';
import { xpProgressInLevel } from '@/utils/gamification';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  xp: number;
  initials: string;
  size?: number;
}

export function AvatarRing({ xp, initials, size = 72 }: Props) {
  const c = useColors();
  const { level, pct } = xpProgressInLevel(xp);
  const sw = size * 0.075;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(pct, { duration: TIMING.epic, easing: Easing.out(Easing.cubic) });
  }, [pct, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: [circ * progress.value, circ - circ * progress.value].join(' '),
  }));

  const inner = size - sw * 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.border} strokeWidth={sw} />
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
          StyleSheet.absoluteFill,
          {
            margin: sw,
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: c.primary,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        <Body style={{ fontFamily: fonts.heading, fontSize: size * 0.22, color: '#FFF', lineHeight: size * 0.24 }}>
          {initials}
        </Body>
        <Caption style={{ fontSize: Math.max(9, size * 0.11), color: 'rgba(255,255,255,0.75)' }}>Lv{level}</Caption>
      </View>
    </View>
  );
}
