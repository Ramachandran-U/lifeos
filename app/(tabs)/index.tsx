import { useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Heading, Body, Label, Caption } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
import { StreakCounter } from '@/components/ui/StreakCounter';
import { RoutineBlock } from '@/components/shared/RoutineBlock';
import { LifeBalanceDashboard } from '@/components/shared/LifeBalanceDashboard';
import { DailyBriefing } from '@/components/shared/DailyBriefing';
import { useUserStore } from '@/store/useUserStore';
import { getRoutineBlocksByDate, updateRoutineBlockStatus } from '@/db/queries/routine';
import { getOrCreateGamification } from '@/db/queries/gamification';
import { logBehaviourEvent, generateWeeklyInsight } from '@/db/queries/behaviour';
import { useState } from 'react';

export default function TodayScreen() {
  const { userId, name } = useUserStore();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [blocks, setBlocks] = useState<ReturnType<typeof getRoutineBlocksByDate>>([]);
  const [domainScores, setDomainScores] = useState({
    goals: 0, health: 0, finance: 0, career: 0, social: 0, mind: 0,
  });

  const loadData = useCallback(() => {
    const todayBlocks = getRoutineBlocksByDate(today);
    setBlocks(todayBlocks);

    if (userId) {
      const game = getOrCreateGamification(userId);
      try {
        setDomainScores(JSON.parse(game.domainScores));
      } catch {
        // keep defaults
      }
    }
    setWeeklyInsight(generateWeeklyInsight());
  }, [today, userId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const [weeklyInsight, setWeeklyInsight] = useState<string | null>(null);

  const handleComplete = (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    updateRoutineBlockStatus(blockId, 'completed');
    logBehaviourEvent('block_completed', block?.module ?? 'goal');
    loadData();
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const completedCount = blocks.filter((b) => b.status === 'completed').length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Heading>{greeting}, {name || 'there'}</Heading>
            <Caption>{format(new Date(), 'EEEE, MMMM d')}</Caption>
          </View>
          <StreakCounter count={0} />
        </View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <LifeBalanceDashboard scores={domainScores} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <DailyBriefing
            text={blocks.length > 0
              ? `You have ${blocks.length} blocks planned today. ${completedCount} completed so far. Keep going!`
              : 'No routine set up yet. Complete onboarding to get your personalised daily plan.'
            }
          />
        </Animated.View>

        {weeklyInsight && (
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <Card style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <Ionicons name="analytics-outline" size={18} color={colors.primary} />
                <Label color={colors.primary}>WEEKLY INSIGHT</Label>
              </View>
              <Body style={styles.insightText}>{weeklyInsight}</Body>
            </Card>
          </Animated.View>
        )}

        {blocks.length > 0 ? (
          <View style={styles.blocksSection}>
            <Body style={styles.sectionTitle}>Today's Routine</Body>
            {blocks
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map((block) => (
                <RoutineBlock
                  key={block.id}
                  id={block.id}
                  startTime={block.startTime}
                  endTime={block.endTime}
                  title={block.title}
                  module={block.module}
                  status={block.status}
                  onComplete={handleComplete}
                />
              ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
            <Body style={styles.emptyText}>No routine yet</Body>
            <Caption>Complete onboarding to get started</Caption>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: spacing.md,
  },
  blocksSection: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    marginTop: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  insightCard: {
    gap: spacing.sm,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  insightText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSizes.lg,
  },
});
