import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { EASING, MOTION_BUDGET, useMotionScale } from '@/theme/motion';

// XP chip with a number-roll on change — the old value slides up and fades,
// the new value springs in from below. Mirrors the StreakFlame choreography.
export function XpChip({ amount, prefix = '+' }: { amount: number; prefix?: string }) {
  const c = useColors();
  const motionScale = useMotionScale();

  const prevRef = useRef(amount);
  const [displayAmount, setDisplayAmount] = useState(amount);

  const oldTranslateY = useSharedValue(0);
  const oldOpacity = useSharedValue(1);
  const newTranslateY = useSharedValue(0);
  const newOpacity = useSharedValue(1);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev === amount) return;
    prevRef.current = amount;

    if (motionScale === 0) {
      setDisplayAmount(amount);
      return;
    }

    const dur = (ms: number) => ms * (1 / motionScale);

    // Old number rises 20px and fades out.
    oldTranslateY.value = 0;
    oldOpacity.value = 1;
    oldTranslateY.value = withTiming(-20, { duration: dur(MOTION_BUDGET.microFeedback), easing: EASING.out });
    oldOpacity.value = withTiming(0, { duration: dur(MOTION_BUDGET.microFeedback), easing: EASING.out });

    // New number springs up from below after the old exits.
    // (swap must wait exactly as long as the old-number slide above).
    const swapDelay = dur(MOTION_BUDGET.microFeedback);
    newTranslateY.value = 20;
    newOpacity.value = 0;
    newTranslateY.value = withDelay(swapDelay, withTiming(0, { duration: dur(MOTION_BUDGET.reveal), easing: EASING.bounce }));
    newOpacity.value = withDelay(swapDelay, withTiming(1, { duration: dur(MOTION_BUDGET.reveal), easing: EASING.bounce }));

    const t = setTimeout(() => {
      setDisplayAmount(amount);
      oldTranslateY.value = 0;
      oldOpacity.value = 1;
      newTranslateY.value = 0;
      newOpacity.value = 1;
    }, swapDelay);
    return () => clearTimeout(t);
  }, [amount, motionScale, oldTranslateY, oldOpacity, newTranslateY, newOpacity]);

  const oldStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: oldTranslateY.value }],
    opacity: oldOpacity.value,
  }));
  const newStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: newTranslateY.value }],
    opacity: newOpacity.value,
  }));

  const textStyle = { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: c.xp } as const;
  const lineHeight = fontSizes.xs * 1.4;
  const animating = motionScale !== 0 && displayAmount !== amount;

  return (
    <View
      style={[styles.chip, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}
      accessibilityRole="text"
      accessibilityLabel={`${prefix}${amount} XP`}
    >
      <Text style={textStyle}>{prefix}</Text>
      <View style={[styles.numberContainer, { height: lineHeight }]}>
        <Animated.Text style={[textStyle, styles.absText, oldStyle]}>{displayAmount}</Animated.Text>
        {animating && (
          <Animated.Text style={[textStyle, styles.absText, newStyle]}>{amount}</Animated.Text>
        )}
      </View>
      <Text style={textStyle}> XP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  numberContainer: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 8,
  },
  absText: {
    position: 'absolute',
  },
});
