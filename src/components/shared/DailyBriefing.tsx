import { useEffect } from 'react';
import { StyleSheet, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts } from '@/theme/typography';
import { Body, Label, Caption } from '@/components/ui/Typography';
import { EASING, MOTION_BUDGET, TIMING, useMotionScale } from '@/theme/motion';
import { useTypedText } from '@/hooks/useTypedText';

interface DailyBriefingProps {
  text: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
}

export function DailyBriefing({ text, ctaLabel, onCtaPress }: DailyBriefingProps) {
  const c = useColors();
  const motionScale = useMotionScale();
  const typed = useTypedText(text, { charsPerSecond: 49 });

  // Sparkle pulse on the leading ✦ — one-shot when the briefing mounts.
  const sparkle = useSharedValue(0);
  useEffect(() => {
    if (motionScale === 0) return;
    sparkle.value = withSequence(
      withTiming(1, { duration: TIMING.normal, easing: EASING.out }),
      withTiming(0, { duration: MOTION_BUDGET.reveal, easing: EASING.inOut }),
    );
  }, [motionScale, sparkle, text]);

  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: 0.7 + sparkle.value * 0.3,
    transform: [{ scale: 1 + sparkle.value * 0.25 }],
  }));

  return (
    // V4 — AI-speaking surface: solid ink card; the violet lives in the
    // identity mark + eyebrow, never a gradient wash (Manifesto P3).
    <View style={[styles.container, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.headerRow}>
        <Animated.Text style={[styles.sparkle, { color: c.primary }, sparkleStyle]}>
          ✦
        </Animated.Text>
        <Label color={c.primary}>DAILY BRIEFING</Label>
      </View>
      <Body style={[styles.text, { color: c.textSecondary }]}>{typed}</Body>
      {ctaLabel && onCtaPress && (
        <Pressable onPress={onCtaPress} style={[styles.cta, { backgroundColor: c.primary }]} hitSlop={6}>
          <Caption style={[styles.ctaText, { color: c.onPrimary }]}>{ctaLabel}</Caption>
          <Ionicons name="arrow-forward" size={14} color={c.onPrimary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sparkle: {
    fontSize: 14,
    fontFamily: fonts.heading,
  },
  text: {
    lineHeight: 22,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    marginTop: 4,
  },
  ctaText: {
    fontFamily: fonts.heading,
  },
});
