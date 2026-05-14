import { useEffect } from 'react';
import { StyleSheet, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import { EASING, useMotionScale } from '@/theme/motion';
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
      withTiming(1, { duration: 320, easing: EASING.out }),
      withTiming(0, { duration: 400, easing: EASING.inOut }),
    );
  }, [motionScale, sparkle, text]);

  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: 0.7 + sparkle.value * 0.3,
    transform: [{ scale: 1 + sparkle.value * 0.25 }],
  }));

  return (
    <LinearGradient
      colors={[c.primary + '30', c.career + '10']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { borderColor: c.border }]}
    >
      <View style={styles.headerRow}>
        <Animated.Text style={[styles.sparkle, { color: c.primary }, sparkleStyle]}>
          ✦
        </Animated.Text>
        <Label color={c.primary}>DAILY BRIEFING</Label>
      </View>
      <Body style={[styles.text, { color: c.textSecondary }]}>{typed}</Body>
      {ctaLabel && onCtaPress && (
        <Pressable onPress={onCtaPress} style={[styles.cta, { backgroundColor: c.primary }]} hitSlop={6}>
          <Caption style={[styles.ctaText, { color: '#fff' }]}>{ctaLabel}</Caption>
          <Ionicons name="arrow-forward" size={14} color="#fff" />
        </Pressable>
      )}
    </LinearGradient>
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
