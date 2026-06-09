import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { MOTION_BUDGET } from '@/theme/motion';
import { STREAK_META, type StreakKey } from '@/utils/gamification';
import type { MilestoneTier } from '@/gamification/streakEngine';
import { CelebrationBurst } from './CelebrationBurst';

interface Props {
  milestone: { streakKey: StreakKey; tier: MilestoneTier } | null;
  onClose: () => void;
}

// Streak milestone celebration (streak_protection_v1). Same non-blocking
// banner contract as LevelUpOverlay — a milestone deserves a louder moment
// than a routine beat, but never a full-screen seizure. The celebration burst
// scales with the tier; the copy frames IDENTITY ("30 days of showing up"),
// not score, per the compassionate-gamification ground rules.
const AUTO_DISMISS_MS = 6000;

const TIER_COPY: Record<MilestoneTier, { kicker: string; line: (label: string) => string }> = {
  7:   { kicker: 'ONE FULL WEEK 🔥', line: (l) => `7 days of showing up for ${l}` },
  30:  { kicker: 'A WHOLE MONTH ✨',  line: (l) => `30 days of showing up for ${l}` },
  100: { kicker: 'DAY ONE HUNDRED 🏆', line: (l) => `100 days. ${l} is who you are now.` },
  365: { kicker: 'ONE FULL YEAR 🌟', line: (l) => `365 days of ${l}. Extraordinary.` },
};

// Burst loudness scales with the tier — 7 is warm, 365 is the works.
const TIER_BURST: Record<MilestoneTier, { count: number; size: number }> = {
  7:   { count: 10, size: 6 },
  30:  { count: 14, size: 8 },
  100: { count: 18, size: 9 },
  365: { count: 24, size: 10 },
};

export function MilestoneOverlay({ milestone, onClose }: Props) {
  const c = useColors();

  useEffect(() => {
    if (!milestone) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
    const t = setTimeout(onClose, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [milestone, onClose]);

  if (!milestone) return null;

  const meta = STREAK_META[milestone.streakKey];
  const copy = TIER_COPY[milestone.tier];
  const burst = TIER_BURST[milestone.tier];
  const glow = Platform.OS === 'web'
    ? ({ boxShadow: `0 12px 40px ${c.streak}44` } as unknown as object)
    : undefined;

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <CelebrationBurst
        palette={[c.streak, c.warning, c.xp]}
        count={burst.count}
        size={burst.size}
        originTop={110}
      />
      <Animated.View
        entering={FadeInDown.duration(MOTION_BUDGET.reveal)}
        exiting={FadeOutUp.duration(MOTION_BUDGET.microFeedback)}
      >
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={`${milestone.tier}-day ${meta.label} streak milestone. Tap to dismiss.`}
          style={[
            styles.banner,
            { backgroundColor: c.surface, borderColor: c.streak + '55' },
            glow as object,
          ]}
        >
          <View style={[styles.tierBadge, { backgroundColor: c.streak + '22', borderColor: c.streak + '55' }]}>
            <Text style={[styles.tierNum, { color: c.streak }]}>{milestone.tier}</Text>
          </View>
          <View style={styles.copy}>
            <Text style={[styles.kicker, { color: c.textMuted }]}>{copy.kicker}</Text>
            <Text style={[styles.title, { color: c.textPrimary }]} numberOfLines={1}>
              {meta.emoji} {copy.line(meta.label)}
            </Text>
          </View>
          <Text style={[styles.dismiss, { color: c.textMuted }]}>✕</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    zIndex: 61, // above LevelUpOverlay (60) — milestone outranks level-up
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    maxWidth: 440,
    width: '100%',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  tierBadge: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierNum: { fontFamily: fonts.heading, fontSize: fontSizes.lg, fontWeight: '800' },
  copy: { flex: 1, gap: 1 },
  kicker: { fontFamily: fonts.heading, fontSize: 10.5, letterSpacing: 1.5 },
  title: { fontFamily: fonts.heading, fontSize: fontSizes.md },
  dismiss: { fontSize: 16, paddingHorizontal: spacing.xs },
});
