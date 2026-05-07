import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Caption, Heading } from '@/components/ui/Typography';
import { useGameStore } from '@/store/useGameStore';
import { XP_VALUES, BadgeId } from '@/utils/gamification';

const BADGE_INFO: Record<BadgeId, { icon: string; name: string; subtitle: string }> = {
  first_blueprint: { icon: '📋', name: 'First Blueprint', subtitle: 'You built your first daily routine' },
  first_blood_report: { icon: '🩸', name: 'Blood Report Pioneer', subtitle: 'You uploaded your first blood report' },
  streak_30_any: { icon: '🔥', name: '30-Day Streak', subtitle: 'You maintained a streak for 30 days' },
  skill_mastery: { icon: '🎓', name: 'Skill Mastery', subtitle: 'You completed your first learning resource' },
  life_balance: { icon: '⚖️', name: 'Life in Balance', subtitle: 'All your domain scores are above 60' },
  goal_complete: { icon: '🏆', name: 'Mission Accomplished', subtitle: 'You completed a life goal' },
  week_1: { icon: '📅', name: 'One Week Strong', subtitle: 'You used LifeOS for 7 consecutive days' },
  food_photo: { icon: '📸', name: 'Food Photographer', subtitle: 'You logged your first meal with a photo' },
};

export function AchievementToast() {
  const pendingCount = useGameStore((s) => s.pendingBadges.length);
  const popBadge = useGameStore((s) => s.popBadge);
  const [currentBadge, setCurrentBadge] = useState<BadgeId | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const badge = popBadge();
    if (badge) {
      setCurrentBadge(badge);
      setVisible(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const timer = setTimeout(() => {
        setVisible(false);
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [pendingCount, visible, popBadge]);

  if (!visible || !currentBadge) return null;

  const info = BADGE_INFO[currentBadge];

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      exiting={FadeOutDown.duration(300)}
      style={styles.container}
    >
      <Body style={styles.icon}>{info.icon}</Body>
      <View style={styles.content}>
        <Heading style={styles.name}>{info.name}</Heading>
        <Caption style={styles.subtitle}>{info.subtitle}</Caption>
      </View>
      <View style={styles.xpBadge}>
        <Body style={styles.xpText}>+{XP_VALUES.earnBadge} XP</Body>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 120,
    left: spacing.xl,
    right: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.badge,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    elevation: 10,
    shadowColor: colors.badge,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  icon: {
    fontSize: 32,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: fontSizes.lg,
  },
  subtitle: {
    marginTop: 2,
  },
  xpBadge: {
    backgroundColor: colors.xp + '30',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  xpText: {
    color: colors.xp,
    fontFamily: fonts.heading,
    fontSize: fontSizes.sm,
  },
});
