import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { MOTION_BUDGET } from '@/theme/motion';
import { STREAK_META, type StreakKey } from '@/utils/gamification';

interface Props {
  streakKey: StreakKey;
  lostCount: number;
  /** Restores the run (useGameStore.restoreStreak) — the user already showed up today. */
  onRestore: () => void;
  onDismiss: () => void;
}

// Streak loss recovery (streak_protection_v1). Compassion constraint: a break
// is framed as "took a break", never failure — and the card leads with the
// fix, not the loss. A loss is only ever detected at activity time (the user
// just logged the qualifying activity, which is what re-triggered the streak),
// so restoring is honest: they showed up today; one tap reconnects the run.
export function StreakRecoveryCard({ streakKey, lostCount, onRestore, onDismiss }: Props) {
  const c = useColors();
  const meta = STREAK_META[streakKey];
  const accent = (c as Record<string, string>)[meta.colorKey] ?? c.streak;

  const handleRestore = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
    onRestore();
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(MOTION_BUDGET.reveal)}
      exiting={FadeOutUp.duration(MOTION_BUDGET.microFeedback)}
      style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
    >
      <Text style={[styles.title, { color: c.textPrimary }]}>
        {meta.emoji} Your {lostCount}-day {meta.label} streak took a break
      </Text>
      <Text style={[styles.body, { color: c.textSecondary }]}>
        You showed up today — that counts. Pick the run back up at {lostCount + 1} days, like it never broke.
      </Text>
      <View style={styles.actions}>
        <Pressable
          onPress={handleRestore}
          accessibilityRole="button"
          accessibilityLabel={`Restore ${meta.label} streak`}
          style={[styles.cta, { backgroundColor: 'transparent', borderColor: c.border }]}
        >
          {/* R2 — the streak's own ink carries the action; chrome neutral. */}
          <Text style={[styles.ctaText, { color: accent }]}>Bring it back</Text>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss streak recovery"
          hitSlop={8}
        >
          <Text style={[styles.dismiss, { color: c.textMuted }]}>Not today</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  title: { fontFamily: fonts.heading, fontSize: fontSizes.md },
  body: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 20 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  cta: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.control,
    borderWidth: 1,
  },
  ctaText: { fontFamily: fonts.heading, fontSize: fontSizes.sm },
  dismiss: { fontFamily: fonts.body, fontSize: fontSizes.sm },
});
