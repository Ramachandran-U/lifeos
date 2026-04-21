import { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Heading, Body, Label, Caption } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
import { StreakCounter } from '@/components/ui/StreakCounter';
import { RoutineBlock } from '@/components/shared/RoutineBlock';
import { LifeBalanceDashboard } from '@/components/shared/LifeBalanceDashboard';
import { DailyBriefing } from '@/components/shared/DailyBriefing';
import { ProfileSidebar } from '@/components/shared/ProfileSidebar';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import { getRoutineBlocksByDate, updateRoutineBlockStatus } from '@/db/queries/routine';
import { getOrCreateGamification } from '@/db/queries/gamification';
import { logBehaviourEvent, generateWeeklyInsight } from '@/db/queries/behaviour';

export default function TodayScreen() {
  const c = useColors();
  const { userId, name } = useUserStore();
  const loadGame = useGameStore((s) => s.loadFromDB);
  const streaks = useGameStore((s) => s.streaks);
  const totalXP = useGameStore((s) => s.totalXP);
  const today = format(new Date(), 'yyyy-MM-dd');
  const [blocks, setBlocks] = useState<ReturnType<typeof getRoutineBlocksByDate>>([]);
  const [domainScores, setDomainScores] = useState({
    goals: 0, health: 0, finance: 0, career: 0, social: 0, mind: 0,
  });
  const [weeklyInsight, setWeeklyInsight] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadData = useCallback(() => {
    const todayBlocks = getRoutineBlocksByDate(today);
    setBlocks(todayBlocks);
    if (userId) {
      const game = getOrCreateGamification(userId);
      try { setDomainScores(JSON.parse(game.domainScores)); } catch { /* keep defaults */ }
      loadGame(userId);
    }
    setWeeklyInsight(generateWeeklyInsight());
  }, [today, userId, loadGame]);

  const topStreak = useMemo(
    () => Math.max(0, ...Object.values(streaks).map((s) => s.count)),
    [streaks],
  );

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

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

  // Avatar initials
  const initials = (name || 'U')
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '')
    .join('');

  const styles = makeStyles(c);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              style={styles.avatarBtn}
              onPress={() => setSidebarOpen(true)}
              hitSlop={8}
            >
              <View style={styles.avatar}>
                <Body style={styles.avatarText}>{initials}</Body>
              </View>
            </Pressable>

            <View style={styles.headerCenter}>
              <Heading style={{ color: c.textPrimary }}>{greeting}, {name || 'there'}</Heading>
              <Caption style={{ color: c.textSecondary }}>{format(new Date(), 'EEEE, MMMM d')}</Caption>
            </View>

            <View style={styles.gameRow}>
              {topStreak > 0 && (
                <View style={styles.streakChip}>
                  <Ionicons name="flame" size={14} color={c.streak} />
                  <Label style={{ color: c.streak, fontSize: fontSizes.xs }}>{topStreak}d</Label>
                </View>
              )}
              <View style={styles.xpChip}>
                <Ionicons name="flash" size={12} color={c.xp} />
                <Label style={{ color: c.xp, fontSize: fontSizes.xs }}>{totalXP} XP</Label>
              </View>
            </View>
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
                  <Ionicons name="analytics-outline" size={18} color={c.primary} />
                  <Label color={c.primary}>WEEKLY INSIGHT</Label>
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
              <Ionicons name="calendar-outline" size={48} color={c.textMuted} />
              <Body style={[styles.emptyText, { color: c.textMuted }]}>No routine yet</Body>
              <Caption style={{ color: c.textMuted }}>Complete onboarding to get started</Caption>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Sidebar — rendered outside ScrollView so it overlays the full screen */}
      <ProfileSidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </View>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    container: {
      flex: 1,
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
      alignItems: 'center',
      paddingTop: spacing.md,
      gap: spacing.sm,
    },
    avatarBtn: {
      marginRight: spacing.xs,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: '#FFF',
      fontFamily: fonts.heading,
      fontSize: fontSizes.sm,
    },
    headerCenter: {
      flex: 1,
    },
    gameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    streakChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: c.streak + '22',
    },
    xpChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: c.xp + '22',
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
      color: c.textSecondary,
      fontSize: fontSizes.sm,
      lineHeight: 20,
    },
    blocksSection: {
      gap: spacing.sm,
    },
    sectionTitle: {
      fontFamily: fonts.heading,
      fontSize: fontSizes.lg,
      marginTop: spacing.sm,
      color: c.textPrimary,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
      gap: spacing.sm,
    },
    emptyText: {
      fontSize: fontSizes.lg,
    },
  });
}
