import { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Text, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Caption } from '@/components/ui/Typography';
import { RoutineBlock } from '@/components/shared/RoutineBlock';
import { DailyBriefing } from '@/components/shared/DailyBriefing';
import { ProfileSidebar } from '@/components/shared/ProfileSidebar';
import { AvatarRing } from '@/components/gamification/AvatarRing';
import { HexRadar } from '@/components/gamification/HexRadar';
import { XPBar } from '@/components/gamification/XPBar';
import { StreakFlame } from '@/components/gamification/StreakFlame';
import { QuestCard } from '@/components/gamification/QuestCard';
import { LevelUpOverlay } from '@/components/gamification/LevelUpOverlay';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import { getRoutineBlocksByDate, updateRoutineBlockStatus } from '@/db/queries/routine';
import { getOrCreateGamification } from '@/db/queries/gamification';
import { logBehaviourEvent, generateWeeklyInsight } from '@/db/queries/behaviour';
import {
  xpProgressInLevel,
  STREAK_META,
  DomainKey,
  DOMAIN_META,
} from '@/utils/gamification';

export default function TodayScreen() {
  const c = useColors();
  const router = useRouter();
  const { width: winWidth } = useWindowDimensions();
  const { userId, name } = useUserStore();
  const today = format(new Date(), 'yyyy-MM-dd');

  // Game store selectors
  const totalXP    = useGameStore((s) => s.totalXP);
  const streaks    = useGameStore((s) => s.streaks);
  const quests     = useGameStore((s) => s.quests);
  const pendingLevelUps = useGameStore((s) => s.pendingLevelUps);
  const popLevelUp = useGameStore((s) => s.popLevelUp);
  const loadGameFromDB = useGameStore((s) => s.loadFromDB);

  const [blocks, setBlocks] = useState<ReturnType<typeof getRoutineBlocksByDate>>([]);
  const [domainScores, setDomainScores] = useState({
    goals: 0, health: 0, finance: 0, career: 0, social: 0, mind: 0,
  });
  const [weeklyInsight, setWeeklyInsight] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeDomain, setActiveDomain] = useState<DomainKey | null>(null);
  const [currentLevelUp, setCurrentLevelUp] = useState<number | null>(null);

  const loadData = useCallback(() => {
    const todayBlocks = getRoutineBlocksByDate(today);
    setBlocks(todayBlocks);
    if (userId) {
      const game = getOrCreateGamification(userId);
      try { setDomainScores(JSON.parse(game.domainScores)); } catch { /* keep defaults */ }
      loadGameFromDB(userId);
    }
    setWeeklyInsight(generateWeeklyInsight());
  }, [today, userId, loadGameFromDB]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Drain the level-up queue one at a time
  useFocusEffect(useCallback(() => {
    if (currentLevelUp == null && pendingLevelUps.length > 0) {
      const next = popLevelUp();
      if (next != null) setCurrentLevelUp(next);
    }
  }, [currentLevelUp, pendingLevelUps, popLevelUp]));

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

  const prog = xpProgressInLevel(totalXP);

  // Top 3 streaks (by count)
  const topStreaks = useMemo(() =>
    (Object.entries(streaks) as [keyof typeof streaks, typeof streaks[keyof typeof streaks]][])
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 3),
    [streaks],
  );

  const dailyQuests  = quests.filter((q) => q.type === 'daily');
  const weeklyQuests = quests.filter((q) => q.type === 'weekly');

  // Radar sized to fit width (up to 420). The design target is 420 but on phones
  // we need to cap at the available width (minus side padding).
  const radarSize = Math.min(420, winWidth - spacing.xl * 2);

  // Greatest domain highlight for the daily briefing
  const strongestDomain = useMemo(() => {
    const entries = (Object.entries(domainScores) as [DomainKey, number][]);
    entries.sort(([, a], [, b]) => b - a);
    return entries[0];
  }, [domainScores]);

  const styles = makeStyles(c);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
          {/* Greeting row */}
          <View style={styles.greetingRow}>
            <Pressable onPress={() => setSidebarOpen(true)} hitSlop={8}>
              <AvatarRing xp={totalXP} initials={initials} size={72} />
            </Pressable>
            <View style={styles.greetingBody}>
              <Text
                numberOfLines={1}
                style={[styles.greetingText, { color: c.textPrimary, fontFamily: fonts.display }]}
              >
                {greeting}, {name ? (name.split(' ')[0]) : 'there'} 👋
              </Text>
              <Caption style={{ color: c.textSecondary }}>
                {format(new Date(), 'EEEE, MMMM d')}
              </Caption>
              <View style={styles.xpRow}>
                <View style={styles.xpBarSlot}>
                  <XPBar pct={prog.pct} color={c.primary} height={6} />
                </View>
                <Caption style={{ color: c.textMuted }}>
                  {prog.current}/{prog.needed} XP
                </Caption>
              </View>
            </View>
          </View>

          {/* Chip row */}
          <View style={styles.chipRow}>
            <View style={[styles.chip, { backgroundColor: c.streak + '22' }]}>
              <Text style={{ fontSize: 13 }}>🔥</Text>
              <Text style={[styles.chipText, { color: c.streak }]}>
                {streaks.workout.count}d streak
              </Text>
            </View>
            <View style={[styles.chip, { backgroundColor: c.xp + '22' }]}>
              <Text style={[styles.chipText, { color: c.xp }]}>
                ⚡ {totalXP.toLocaleString()} XP
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/rewards' as never)}
              style={[styles.chip, { backgroundColor: c.primaryLight, borderWidth: 1, borderColor: c.primary + '44' }]}
            >
              <Text style={[styles.chipText, { color: c.primary }]}>🏆 Rewards</Text>
            </Pressable>
          </View>

          {/* Life Balance hex radar */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>LIFE BALANCE</Text>
            </View>
            <View style={styles.radarWrap}>
              <HexRadar
                scores={domainScores}
                size={radarSize}
                activeDomain={activeDomain}
                onDomainPress={(k) => setActiveDomain(k === activeDomain ? null : k)}
              />
            </View>
            {activeDomain && (
              <DomainDetailCard
                domainKey={activeDomain}
                scores={domainScores}
                onClose={() => setActiveDomain(null)}
              />
            )}
          </Animated.View>

          {/* Top streaks */}
          {Object.values(streaks).some((s) => s.count > 0) && (
            <Animated.View entering={FadeInDown.delay(150).duration(400)}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>TOP STREAKS</Text>
              </View>
              <View style={styles.streakRow}>
                {topStreaks.map(([key, streak]) => {
                  const meta = STREAK_META[key];
                  const color = (c as unknown as Record<string, string>)[meta.colorKey] ?? c.primary;
                  return (
                    <View
                      key={key}
                      style={[
                        styles.streakCard,
                        { backgroundColor: c.card, borderColor: color + '33' },
                      ]}
                    >
                      <View style={styles.streakTop}>
                        <Text style={{ fontSize: 16 }}>{meta.emoji}</Text>
                        <Caption style={{ color: c.textSecondary }}>{meta.label}</Caption>
                      </View>
                      <StreakFlame count={streak.count} graceUsed={streak.graceUsed} size="sm" />
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          )}

          {/* Active quests */}
          {dailyQuests.length > 0 && (
            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>ACTIVE QUESTS</Text>
                <Pressable onPress={() => router.push('/rewards' as never)}>
                  <Caption style={{ color: c.primary }}>View all</Caption>
                </Pressable>
              </View>
              <View style={styles.questList}>
                {dailyQuests.map((q) => (
                  <QuestCard key={q.id} quest={q} compact />
                ))}
              </View>
            </Animated.View>
          )}

          {/* Weekly quest */}
          {weeklyQuests.length > 0 && (
            <Animated.View entering={FadeInDown.delay(225).duration(400)}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>WEEKLY QUEST</Text>
              </View>
              <View style={styles.questList}>
                {weeklyQuests.map((q) => (
                  <QuestCard key={q.id} quest={q} compact />
                ))}
              </View>
            </Animated.View>
          )}

          {/* Daily briefing */}
          <Animated.View entering={FadeInDown.delay(250).duration(400)}>
            <DailyBriefing
              text={buildBriefing(
                completedCount,
                blocks.length,
                strongestDomain,
                domainScores,
              )}
            />
          </Animated.View>

          {weeklyInsight && (
            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <View
                style={[
                  styles.insightCard,
                  { backgroundColor: c.card, borderColor: c.border },
                ]}
              >
                <View style={styles.insightHeader}>
                  <Ionicons name="analytics-outline" size={18} color={c.primary} />
                  <Caption style={{ color: c.primary, letterSpacing: 0.5 }}>WEEKLY INSIGHT</Caption>
                </View>
                <Body style={[styles.insightText, { color: c.textSecondary }]}>{weeklyInsight}</Body>
              </View>
            </Animated.View>
          )}

          {/* Routine blocks */}
          {blocks.length > 0 ? (
            <View style={styles.blocksSection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>TODAY'S ROUTINE</Text>
                <Caption style={{ color: c.textMuted }}>{completedCount}/{blocks.length} done</Caption>
              </View>
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

      {/* Sidebar overlays everything */}
      <ProfileSidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Level-up celebration */}
      {currentLevelUp != null && (
        <LevelUpOverlay
          visible
          level={currentLevelUp}
          userName={name ?? undefined}
          onClose={() => setCurrentLevelUp(null)}
        />
      )}
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildBriefing(
  completed: number,
  total: number,
  strongest: [DomainKey, number] | undefined,
  scores: Record<DomainKey, number>,
): string {
  if (total === 0) {
    return 'No routine set up yet. Complete onboarding to get your personalised daily plan.';
  }
  const domainMeta = strongest ? DOMAIN_META.find(d => d.key === strongest[0]) : undefined;
  const weakest = (Object.entries(scores) as [DomainKey, number][])
    .sort(([, a], [, b]) => a - b)[0];
  const weakMeta = weakest ? DOMAIN_META.find(d => d.key === weakest[0]) : undefined;

  const head = `You're ${completed} of ${total} blocks in.`;
  if (strongest && strongest[1] > 0 && domainMeta) {
    const tail = weakMeta && weakest && weakest[1] < strongest[1]
      ? ` ${weakMeta.label} is your biggest growth opportunity this week.`
      : '';
    return `${head} Your ${domainMeta.label.toLowerCase()} score is your strongest at ${strongest[1]} — keep that momentum going.${tail}`;
  }
  return `${head} Keep going!`;
}

// ─── Domain Detail Card ──────────────────────────────────────────────────────
// Inline accordion-style detail panel shown under the radar when a domain dot
// is tapped. Avoids the absolute-positioned overlay pattern used on desktop
// since we're in a vertical ScrollView on mobile.

function DomainDetailCard({
  domainKey,
  scores,
  onClose,
}: {
  domainKey: DomainKey;
  scores: Record<DomainKey, number>;
  onClose: () => void;
}) {
  const c = useColors();
  const meta = DOMAIN_META.find((d) => d.key === domainKey);
  if (!meta) return null;
  const color = (c as unknown as Record<string, string>)[meta.colorKey] ?? c.primary;
  const score = scores[domainKey] ?? 0;

  return (
    <Animated.View
      entering={FadeInDown.duration(250)}
      style={{
        backgroundColor: c.card,
        borderColor: color + '44',
        borderWidth: 1,
        borderRadius: 20,
        padding: 20,
        marginTop: spacing.sm,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
          <Text style={{ fontFamily: fonts.display, fontWeight: '800', fontSize: 18, color: c.textPrimary }}>
            {meta.label}
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={{ color: c.textMuted, fontSize: 18 }}>✕</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={{ fontFamily: fonts.display, fontWeight: '800', fontSize: 48, color, lineHeight: 50 }}>
          {score}
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: c.textMuted }}>
          / 100
        </Text>
      </View>
      <XPBar pct={score / 100} color={color} height={8} />
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
      gap: spacing.lg,
    },
    greetingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingTop: spacing.md,
    },
    greetingBody: {
      flex: 1,
      gap: 4,
    },
    greetingText: {
      fontSize: 22,
      fontWeight: '800',
      lineHeight: 26,
    },
    xpRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: 6,
    },
    xpBarSlot: {
      flex: 1,
    },
    chipRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    chipText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      fontWeight: '600',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    sectionLabel: {
      fontFamily: fonts.heading,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    radarWrap: {
      alignItems: 'center',
    },
    streakRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    streakCard: {
      flex: 1,
      minWidth: 140,
      borderWidth: 1,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 6,
    },
    streakTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    questList: {
      gap: spacing.sm,
    },
    insightCard: {
      gap: spacing.sm,
      borderWidth: 1,
      borderRadius: 20,
      padding: spacing.md,
    },
    insightHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    insightText: {
      fontSize: fontSizes.sm,
      lineHeight: 20,
    },
    blocksSection: {
      gap: spacing.sm,
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
