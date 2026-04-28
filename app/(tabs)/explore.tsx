import { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { Card } from '@/components/ui/Card';
import { Body, Heading, Label, Caption } from '@/components/ui/Typography';
import { InterestCard } from '@/components/modules/polymath/InterestCard';
import { AddInterestSheet } from '@/components/modules/polymath/AddInterestSheet';
import { LogExplorationSheet } from '@/components/modules/polymath/LogExplorationSheet';
import { usePolymathStore } from '@/store/usePolymathStore';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import { logBehaviourEvent } from '@/db/queries/behaviour';
import { XP_VALUES } from '@/utils/gamification';
import type { Interest } from '@/db/queries/interests';
import { useScreenTracking } from '@/hooks/useScreenTracking';

export default function ExploreScreen() {
  useScreenTracking('explore');
  const { userId } = useUserStore();
  const { interests, load, addInterest, removeInterest, addExploration, weeklyMinutes } =
    usePolymathStore();
  const { addXP, triggerStreak, completeBlock } = useGameStore();

  const [showAdd, setShowAdd] = useState(false);
  const [activeInterest, setActiveInterest] = useState<Interest | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (userId) load(userId);
    }, [userId, load]),
  );

  const totals = useMemo(() => weeklyMinutes(), [weeklyMinutes, interests]);
  const totalMinutesWeek = useMemo(
    () => Object.values(totals).reduce((a, b) => a + b, 0),
    [totals],
  );

  const handleAdd = (data: { name: string; category: string; weeklyMinutesTarget: number }) => {
    if (!userId) return;
    addInterest({ ...data, userId });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleLog = (data: { minutesSpent: number; notes?: string; date: string }) => {
    if (!userId || !activeInterest) return;
    addExploration({ interestId: activeInterest.id, ...data }, userId);
    logBehaviourEvent('exploration_logged', 'polymath');
    addXP(userId, XP_VALUES.completeGoalTask);
    triggerStreak(userId, 'learning');
    completeBlock(userId, 'polymath', 1, 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDelete = (id: string) => {
    if (!userId) return;
    removeInterest(id, userId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ModuleHeader title="Explore" icon="compass" color={colors.polymath} />

        <Animated.View entering={FadeInDown.duration(400)}>
          <Card moduleColor={colors.polymath} style={styles.summary}>
            <Label color={colors.polymath}>THIS WEEK</Label>
            <Heading style={styles.summaryNumber}>{totalMinutesWeek} min</Heading>
            <Caption>across {interests.length} interest{interests.length === 1 ? '' : 's'}</Caption>
          </Card>
        </Animated.View>

        <View style={styles.listHeader}>
          <Label>INTERESTS</Label>
          <Pressable onPress={() => setShowAdd(true)} style={styles.addBtn}>
            <Ionicons name="add" size={18} color={colors.polymath} />
            <Label color={colors.polymath}>Add</Label>
          </Pressable>
        </View>

        {interests.length === 0 ? (
          <Card style={styles.empty}>
            <Ionicons name="compass-outline" size={32} color={colors.textMuted} />
            <Body style={styles.emptyTitle}>Nothing to explore yet</Body>
            <Caption style={styles.emptyBody}>
              Add an interest you want to spend time on each week — a skill, hobby, or topic.
            </Caption>
          </Card>
        ) : (
          interests.map((interest) => (
            <Animated.View key={interest.id} entering={FadeInDown.duration(300)}>
              <InterestCard
                interest={interest}
                weeklyActual={totals[interest.id] ?? 0}
                onLog={() => setActiveInterest(interest)}
                onDelete={() => handleDelete(interest.id)}
              />
            </Animated.View>
          ))
        )}
      </ScrollView>

      <AddInterestSheet
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={handleAdd}
      />
      <LogExplorationSheet
        visible={!!activeInterest}
        interestName={activeInterest?.name ?? ''}
        onClose={() => setActiveInterest(null)}
        onLog={handleLog}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  summary: {
    gap: spacing.xs,
  },
  summaryNumber: {
    fontSize: 32,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.polymathLight,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    marginTop: spacing.xs,
  },
  emptyBody: {
    textAlign: 'center',
    color: colors.textSecondary,
  },
});
