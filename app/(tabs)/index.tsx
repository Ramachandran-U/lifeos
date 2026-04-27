import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Heading, Body, Label, Caption } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
import { RoutineBlock } from '@/components/shared/RoutineBlock';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { getReflectionByDate } from '@/db/queries/reflections';
import { DailyBriefing } from '@/components/shared/DailyBriefing';
import { ProfileSidebar } from '@/components/shared/ProfileSidebar';
import { VoiceAssistantSheet } from '@/components/shared/VoiceAssistantSheet';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import { AvatarRing } from '@/components/gamification/AvatarRing';
import { HexRadar } from '@/components/gamification/HexRadar';
import { XpBar } from '@/components/gamification/XpBar';
import { StreakFlame } from '@/components/gamification/StreakFlame';
import { QuestCard } from '@/components/gamification/QuestCard';
import { STREAK_META, type StreakKey } from '@/constants/gamification';
import { xpProgressInLevel } from '@/utils/gamification';
import { getRoutineBlocksByDate, updateRoutineBlockStatus, setRoutineBlockCalendarEventId } from '@/db/queries/routine';
import { isCalendarConnected, startCalendarOAuth, clearCalendarTokens } from '@/integrations/googleCalendar/oauth';
import { syncBlocksToCalendar } from '@/integrations/googleCalendar/client';
import { updateUser } from '@/db/queries/users';
import { getOrCreateGamification } from '@/db/queries/gamification';
import { logBehaviourEvent, generateWeeklyInsight } from '@/db/queries/behaviour';

export default function TodayScreen() {
  const c = useColors();
  const router = useRouter();
  const { userId, name } = useUserStore();
  const activatedModules = useUserStore((s) => s.activatedModules);
  const primaryDomains = useUserStore((s) => s.primaryDomains);
  const setOnboardingStage = useUserStore((s) => s.setOnboardingStage);

  const startOnboarding = useCallback(() => {
    if (userId) updateUser(userId, { onboardingStage: 0 });
    setOnboardingStage(0);
    router.replace('/(onboarding)/day1-vision');
  }, [userId, setOnboardingStage, router]);
  const loadGame = useGameStore((s) => s.loadFromDB);
  const streaks = useGameStore((s) => s.streaks);
  const totalXP = useGameStore((s) => s.totalXP);
  const quests = useGameStore((s) => s.quests);
  const gameDomainScores = useGameStore((s) => s.domainScores);
  const today = format(new Date(), 'yyyy-MM-dd');
  const [blocks, setBlocks] = useState<ReturnType<typeof getRoutineBlocksByDate>>([]);
  const [domainScores, setDomainScores] = useState({
    goals: 0, health: 0, finance: 0, career: 0, social: 0, mind: 0,
  });
  const [weeklyInsight, setWeeklyInsight] = useState<string | null>(null);
  const [hasReflectedToday, setHasReflectedToday] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [calConnected, setCalConnected] = useState(false);
  const [calSyncing, setCalSyncing] = useState(false);
  const [calStatus, setCalStatus] = useState<string | null>(null);

  const handleCalendarConnect = async () => {
    const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setCalStatus('Missing EXPO_PUBLIC_GOOGLE_CLIENT_ID — see .env.example.');
      return;
    }
    await startCalendarOAuth(clientId);
  };

  const handleCalendarDisconnect = () => {
    clearCalendarTokens();
    setCalConnected(false);
    setCalStatus('Disconnected.');
  };

  const handleCalendarSync = async () => {
    const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) { setCalStatus('Missing EXPO_PUBLIC_GOOGLE_CLIENT_ID.'); return; }
    if (blocks.length === 0) { setCalStatus('No routine blocks to sync.'); return; }
    setCalSyncing(true);
    setCalStatus(null);
    try {
      const result = await syncBlocksToCalendar(clientId, blocks.map((b) => ({
        id: b.id,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        title: b.title,
        module: b.module,
        notes: b.notes ?? undefined,
        calendarEventId: b.calendarEventId ?? undefined,
      })));
      for (const [blockId, eventId] of Object.entries(result.eventIds)) {
        setRoutineBlockCalendarEventId(blockId, eventId);
      }
      setCalStatus(
        `Synced · ${result.created} added, ${result.updated} updated` +
        (result.failed > 0 ? `, ${result.failed} failed` : ''),
      );
      loadData();
    } catch (err) {
      setCalStatus(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setCalSyncing(false);
    }
  };

  const loadData = useCallback(() => {
    const todayBlocks = getRoutineBlocksByDate(today);
    setBlocks(todayBlocks);
    if (userId) {
      const game = getOrCreateGamification(userId);
      try { setDomainScores(JSON.parse(game.domainScores)); } catch { /* keep defaults */ }
      loadGame(userId);
    }
    setWeeklyInsight(generateWeeklyInsight());
    setHasReflectedToday(getReflectionByDate(today) !== undefined);
  }, [today, userId, loadGame]);

  const topStreaks = useMemo(() => {
    return (Object.keys(STREAK_META) as StreakKey[])
      .map((k) => ({ key: k, ...streaks[k] }))
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, 3);
  }, [streaks]);

  const prog = useMemo(() => xpProgressInLevel(totalXP), [totalXP]);

  useFocusEffect(useCallback(() => {
    loadData();
    setCalConnected(isCalendarConnected());
  }, [loadData]));

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

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const heroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 140], [1, 0], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(scrollY.value, [0, 220], [1, 0.78], Extrapolation.CLAMP) },
      { translateY: interpolate(scrollY.value, [0, 220], [0, -40], Extrapolation.CLAMP) },
    ],
  }));
  const chipStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [120, 200], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [120, 200], [-16, 0], Extrapolation.CLAMP) }],
  }));
  const radarScores = gameDomainScores.goals !== undefined ? gameDomainScores : domainScores;
  const avgScore = Math.round(
    (radarScores.goals + radarScores.health + radarScores.finance +
      radarScores.career + radarScores.social + radarScores.mind) / 6,
  );

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={styles.container}>
        {/* Collapsed header chip — fades in on scroll */}
        <Animated.View pointerEvents="none" style={[styles.collapsedHeader, chipStyle]}>
          <View style={[styles.collapsedChip, { borderColor: c.border, backgroundColor: c.surface + 'EE' }]}>
            <HexRadar scores={radarScores} size={36} />
            <View>
              <Caption style={{ color: c.textMuted, letterSpacing: 1, fontSize: 9 }}>LIFE</Caption>
              <Body style={{ fontFamily: fonts.heading, color: c.textPrimary, fontSize: 16 }}>{avgScore}</Body>
            </View>
          </View>
        </Animated.View>

        <Animated.ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {/* Hex radar hero */}
          <Animated.View style={[styles.heroWrap, heroStyle]}>
            <HexRadar scores={radarScores} size={340} />
          </Animated.View>

          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => setSidebarOpen(true)} hitSlop={8}>
              <AvatarRing xp={totalXP} initials={initials || 'U'} size={64} />
            </Pressable>
            <Pressable
              onPress={() => setVoiceOpen(true)}
              hitSlop={8}
              style={[styles.voiceBtn, { backgroundColor: c.primary + '22', borderColor: c.primary + '55' }]}
              testID="voice-open"
            >
              <Ionicons name="mic" size={20} color={c.primary} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Heading style={{ color: c.textPrimary }}>{greeting}, {name || 'there'}</Heading>
              <Caption style={{ color: c.textSecondary }}>{format(new Date(), 'EEEE, MMMM d')}</Caption>
              <View style={styles.xpRow}>
                <View style={{ flex: 1 }}>
                  <XpBar pct={prog.pct} color={c.primary} height={6} />
                </View>
                <Caption style={{ color: c.textMuted }}>
                  {prog.current}/{prog.needed} XP
                </Caption>
              </View>
            </View>
          </View>

          {/* Top Streaks */}
          {topStreaks.some((s) => (s.count ?? 0) > 0) && (
            <View style={styles.streaksSection}>
              <Body style={styles.sectionLabel}>TOP STREAKS</Body>
              <View style={styles.streakList}>
                {topStreaks.map((s) => {
                  const meta = STREAK_META[s.key];
                  const color = c[meta.colorKey];
                  return (
                    <View
                      key={s.key}
                      style={[styles.streakCard, { backgroundColor: c.card, borderColor: color + '33', borderLeftColor: color }]}
                    >
                      <View style={styles.streakLeft}>
                        <Body style={{ fontSize: 16 }}>{meta.emoji}</Body>
                        <Caption style={{ color: c.textSecondary, fontSize: fontSizes.sm }}>{meta.label}</Caption>
                      </View>
                      <StreakFlame count={s.count ?? 0} graceUsed={s.graceUsed ?? false} size="sm" />
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Active Quests */}
          {quests.length > 0 && (
            <View style={styles.questsSection}>
              <Body style={styles.sectionLabel}>ACTIVE QUESTS</Body>
              <View style={styles.questList}>
                {quests.slice(0, 3).map((q) => (
                  <QuestCard key={q.id} quest={q} compact />
                ))}
              </View>
            </View>
          )}

          {blocks.length > 0 && new Date().getHours() >= 18 && !hasReflectedToday && (
            <Animated.View entering={FadeInDown.delay(180).duration(400)}>
              <Pressable onPress={() => router.push('/evening-reflect')}>
                <Card style={[styles.reflectCard, { borderLeftWidth: 4, borderLeftColor: c.primary }]}>
                  <View style={styles.reflectRow}>
                    <Ionicons name="moon" size={22} color={c.primaryLight} />
                    <View style={{ flex: 1 }}>
                      <Label color={c.primaryLight}>WRAP UP TODAY</Label>
                      <Body style={{ color: c.textSecondary, fontSize: fontSizes.sm, marginTop: 2 }}>
                        60 seconds to reflect and preview tomorrow
                      </Body>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
                  </View>
                </Card>
              </Pressable>
            </Animated.View>
          )}
          {hasReflectedToday && (
            <Animated.View entering={FadeInDown.delay(180).duration(400)}>
              <Card style={styles.reflectCard}>
                <View style={styles.reflectRow}>
                  <Ionicons name="checkmark-circle" size={22} color={c.success} />
                  <Body style={{ color: c.textSecondary, flex: 1 }}>
                    Reflection logged. Tomorrow is ready.
                  </Body>
                </View>
              </Card>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <DailyBriefing
              text={blocks.length > 0
                ? `You have ${blocks.length} blocks planned today. ${completedCount} completed so far. Keep going!`
                : 'No routine set up yet. Complete onboarding to get your personalised daily plan.'
              }
              ctaLabel={blocks.length === 0 ? 'Complete onboarding' : undefined}
              onCtaPress={blocks.length === 0 ? startOnboarding : undefined}
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

          {blocks.length > 0 && primaryDomains.length > 0 && activatedModules.length === 0 && (
            <Animated.View entering={FadeInDown.delay(250).duration(400)}>
              <Card style={[styles.insightCard, { borderLeftWidth: 4, borderLeftColor: c.primary }]}>
                <View style={styles.insightHeader}>
                  <Ionicons name="sparkles" size={18} color={c.primary} />
                  <Label color={c.primary}>YOUR STARTER DAY</Label>
                </View>
                <Body style={styles.insightText}>
                  This is a seeded routine. Tap any block to make it yours — or keep it as-is for today.
                </Body>
              </Card>
            </Animated.View>
          )}

          {blocks.length > 0 ? (
            <View style={styles.blocksSection}>
              <View style={styles.routineHeader}>
                <Body style={styles.sectionTitle}>Today's Routine</Body>
                <Pressable
                  style={[styles.editRoutineBtn, { borderColor: c.border, backgroundColor: c.surface }]}
                  onPress={() => router.push('/(onboarding)/day1-routine')}
                  hitSlop={6}
                >
                  <Ionicons name="pencil" size={14} color={c.primary} />
                  <Caption style={{ color: c.primary, fontFamily: fonts.heading }}>Edit routine</Caption>
                </Pressable>
              </View>

              <Card style={styles.calCard}>
                <View style={styles.calHeader}>
                  <Ionicons name="calendar" size={18} color={c.primary} />
                  <Label color={c.primary}>GOOGLE CALENDAR</Label>
                </View>
                {calConnected ? (
                  <>
                    <Caption style={{ color: c.textSecondary }}>
                      Push today's routine as events with a 10-minute popup reminder on each.
                    </Caption>
                    <View style={styles.calActions}>
                      <Pressable
                        style={[styles.calPrimary, { backgroundColor: c.primary }, calSyncing && { opacity: 0.6 }]}
                        onPress={handleCalendarSync}
                        disabled={calSyncing}
                      >
                        <Ionicons name="sync" size={14} color="#fff" />
                        <Caption style={{ color: '#fff', fontFamily: fonts.heading }}>
                          {calSyncing ? 'Syncing…' : `Sync ${blocks.length} block${blocks.length === 1 ? '' : 's'}`}
                        </Caption>
                      </Pressable>
                      <Pressable style={styles.calSecondary} onPress={handleCalendarDisconnect}>
                        <Caption style={{ color: c.textMuted }}>Disconnect</Caption>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <Caption style={{ color: c.textSecondary }}>
                      Block time for your routine on your calendar and get popup reminders before each block.
                    </Caption>
                    <Pressable
                      style={[styles.calPrimary, { backgroundColor: c.primary, alignSelf: 'flex-start' }]}
                      onPress={handleCalendarConnect}
                    >
                      <Ionicons name="link" size={14} color="#fff" />
                      <Caption style={{ color: '#fff', fontFamily: fonts.heading }}>Connect Google Calendar</Caption>
                    </Pressable>
                  </>
                )}
                {calStatus && <Caption style={{ color: c.textMuted }}>{calStatus}</Caption>}
              </Card>

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
        </Animated.ScrollView>
      </SafeAreaView>

      {/* Sidebar — rendered outside ScrollView so it overlays the full screen */}
      <ProfileSidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <VoiceAssistantSheet
        visible={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        systemInstruction="You are the LifeOS Daily Briefing assistant. Be concise and actionable."
      />
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
      gap: spacing.md,
    },
    headerCenter: { flex: 1, gap: 4 },
    voiceBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    xpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    radarWrap: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
    heroWrap: {
      alignItems: 'center',
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    collapsedHeader: {
      position: 'absolute',
      top: spacing.md,
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 10,
    },
    collapsedChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
    },
    sectionLabel: {
      fontFamily: fonts.heading,
      fontSize: 13,
      color: c.textSecondary,
      letterSpacing: 0.5,
      alignSelf: 'flex-start',
    },
    streaksSection: { gap: spacing.sm },
    streakList: { gap: 8 },
    streakCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderLeftWidth: 3,
    },
    streakLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    questsSection: { gap: spacing.sm },
    questList: { gap: 8 },
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
    routineHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    editRoutineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1,
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
    calCard: {
      gap: spacing.sm,
    },
    calHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    calActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    calPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
    },
    calSecondary: {
      paddingVertical: 10,
      paddingHorizontal: 10,
    },
    reflectCard: {
      gap: 0,
    },
    reflectRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
  });
}
