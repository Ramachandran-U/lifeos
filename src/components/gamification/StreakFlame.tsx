import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { EASING, MOTION_BUDGET, useMotionScale } from '@/theme/motion';

interface Props {
  count: number;
  graceUsed?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: { flame: 18, text: 13 },
  md: { flame: 26, text: 16 },
  lg: { flame: 36, text: 22 },
};

export function StreakFlame({ count, graceUsed = false, size = 'md' }: Props) {
  const c = useColors();
  const s = SIZES[size];
  const opacity = graceUsed ? 0.5 : 1;
  const motionScale = useMotionScale();

  const prevCountRef = useRef(count);
  const [displayCount, setDisplayCount] = useState(count);
  const [showParticle, setShowParticle] = useState(false);

  // Flame inhale
  const flameScale = useSharedValue(1);

  // Old number (slides up + fades out)
  const oldTranslateY = useSharedValue(0);
  const oldOpacity = useSharedValue(1);

  // New number (springs in from below)
  const newTranslateY = useSharedValue(0);
  const newOpacity = useSharedValue(1);

  // +1 particle
  const particleTranslateY = useSharedValue(0);
  const particleOpacity = useSharedValue(0);

  useEffect(() => {
    const prevCount = prevCountRef.current;
    if (prevCount === count) return;
    prevCountRef.current = count;

    if (motionScale === 0) {
      // No animation — just update immediately
      setDisplayCount(count);
      return;
    }

    // 1) Flame inhale: scale 1 → 0.94 → 1
    flameScale.value = withSequence(
      withTiming(0.94, { duration: MOTION_BUDGET.microFeedback * (1 / motionScale), easing: EASING.inOut }),
      withTiming(1, { duration: MOTION_BUDGET.reveal * (1 / motionScale), easing: EASING.out }),
    );

    // 2) Old number slides up 32px + fades out
    oldTranslateY.value = 0;
    oldOpacity.value = 1;
    oldTranslateY.value = withTiming(-32, { duration: MOTION_BUDGET.microFeedback * (1 / motionScale), easing: EASING.out });
    oldOpacity.value = withTiming(0, { duration: MOTION_BUDGET.microFeedback * (1 / motionScale), easing: EASING.out });

    // 3) After old exits, swap display count and spring new in from below
    // (swap must wait exactly as long as the old-number slide above).
    const swapDelay = MOTION_BUDGET.microFeedback * (1 / motionScale);
    newTranslateY.value = 32;
    newOpacity.value = 0;
    newTranslateY.value = withDelay(
      swapDelay,
      withTiming(0, { duration: MOTION_BUDGET.reveal * (1 / motionScale), easing: EASING.bounce }),
    );
    newOpacity.value = withDelay(
      swapDelay,
      withTiming(1, { duration: MOTION_BUDGET.reveal * (1 / motionScale), easing: EASING.bounce }),
    );

    // Update displayCount after old exits
    const timeout = setTimeout(() => {
      setDisplayCount(count);
      // Reset old number position for next cycle
      oldTranslateY.value = 0;
      oldOpacity.value = 1;
      newTranslateY.value = 0;
      newOpacity.value = 1;
    }, swapDelay);

    // 4) +1 particle drifts up 28px and fades over 900ms
    setShowParticle(true);
    particleTranslateY.value = 0;
    particleOpacity.value = 1;
    particleTranslateY.value = withTiming(-28, { duration: MOTION_BUDGET.shimmer * (1 / motionScale), easing: EASING.out }); // particle drift ≈ shimmer period
    particleOpacity.value = withTiming(0, { duration: MOTION_BUDGET.shimmer * (1 / motionScale), easing: EASING.out }); // particle drift ≈ shimmer period

    const particleTimeout = setTimeout(() => {
      setShowParticle(false);
    }, MOTION_BUDGET.shimmer * (1 / motionScale));

    return () => {
      clearTimeout(timeout);
      clearTimeout(particleTimeout);
    };
  }, [count, motionScale]);

  const flameAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flameScale.value }],
  }));

  const oldNumberStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: oldTranslateY.value }],
    opacity: oldOpacity.value,
  }));

  const newNumberStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: newTranslateY.value }],
    opacity: newOpacity.value,
  }));

  const particleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: particleTranslateY.value }],
    opacity: particleOpacity.value,
  }));

  const numberHeight = s.text * 1.3;

  return (
    <View style={[styles.row, { opacity }]}>
      <Animated.Text style={[{ fontSize: s.flame }, flameAnimStyle]}>🔥</Animated.Text>
      <View style={[styles.numberContainer, { height: numberHeight }]}>
        <Animated.Text
          style={[
            {
              fontFamily: fonts.heading,
              fontSize: s.text,
              color: c.streak,
              position: 'absolute',
            },
            oldNumberStyle,
          ]}
        >
          {displayCount}
        </Animated.Text>
        <Animated.Text
          style={[
            {
              fontFamily: fonts.heading,
              fontSize: s.text,
              color: c.streak,
              position: 'absolute',
            },
            newNumberStyle,
          ]}
        >
          {count}
        </Animated.Text>
      </View>
      {showParticle && (
        <Animated.Text
          style={[
            {
              fontFamily: fonts.heading,
              fontSize: s.text * 0.7,
              color: c.streak,
              position: 'absolute',
              right: -s.text * 1.2,
              top: -4,
            },
            particleStyle,
          ]}
        >
          +1
        </Animated.Text>
      )}
      {graceUsed && (
        <Text style={{ fontFamily: fonts.body, fontSize: 10, color: c.textMuted, marginLeft: 2 }}>
          grace
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, position: 'relative' },
  numberContainer: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 20,
  },
});
