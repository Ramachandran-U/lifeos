import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { GlassCard } from '@/components/ui/GlassCard';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Text as AuroraText } from '@/components/ui/Text';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { useGameStore } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { useDomainHistoryStore } from '@/store/useDomainHistoryStore';
import { useXpHistoryStore } from '@/store/useXpHistoryStore';
import { xpProgressInLevel } from '@/utils/gamification';
import { BADGE_META, DOMAIN_META, STREAK_META, type StreakKey, type Quest } from '@/constants/gamification';
import { LevelRing } from '@/components/gamification/LevelRing';
import { XpBar } from '@/components/gamification/XpBar';
import { Sparkline } from '@/components/gamification/Sparkline';
import { LevelLadder } from '@/components/gamification/LevelLadder';
import { BadgeTile } from '@/components/gamification/BadgeTile';
import { StreakRow } from '@/components/gamification/StreakRow';
import { QuestCard } from '@/components/gamification/QuestCard';
import { QuestDetailSheet } from '@/components/gamification/QuestDetailSheet';
import { DomainMiniCard } from '@/components/gamification/DomainMiniCard';
import type { BadgeId } from '@/utils/gamification';
import { useScreenTracking } from '@/hooks/useScreenTracking';

type Section = 'overview' | 'badges' | 'streaks' | 'quests';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'badges', label: 'Badges' },
  { id: 'streaks', label: 'Streaks' },
  { id: 'quests', label: 'Quests' },
];

export default function RewardsScreen() {
  useScreenTracking('rewards');
  const c = useColors();
  const { userId } = useUserStore();
  const loadGame = useGameStore((s) => s.loadFromDB);
  const totalXP = useGameStore((s) => s.totalXP);
  const weeklyXP = useGameStore((s) => s.weeklyXP);
  const badges = useGameStore((s) => s.badges);
  const streaks = useGameStore((s) => s.streaks);
  const domainScores = useGameStore((s) => s.domainScores);
  const historyFor = useDomainHistoryStore((s) => s.historyFor);
  const deltaFor = useDomainHistoryStore((s) => s.deltaFor);
  const xpDailyGains = useXpHistoryStore((s) => s.dailyGains);
  const xpEntries = useXpHistoryStore((s) => s.entries);
  const quests = useGameStore((s) => s.quests);
  const [section, setSection] = useState<Section>('overview');
  const [openQuest, setOpenQuest] = useState<Quest | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (userId) loadGame(userId);
    }, [userId, loadGame]),
  );

  const prog = useMemo(() => xpProgressInLevel(totalXP), [totalXP]);
  // Real daily-XP series for the 7-day chart (replaces the old mock). Pad a
  // short/empty series to >=2 points so a new user sees a flat baseline instead
  // of a broken sparkline. `xpEntries` is a dep so it recomputes after a record.
  const xpSpark = useMemo(() => {
    const gains = xpDailyGains(7);
    return gains.length >= 2 ? gains : [0, ...gains, 0];
  }, [xpDailyGains, xpEntries]);
  const allBadgeIds = Object.keys(BADGE_META) as BadgeId[];
  const bestStreak = Math.max(0, ...Object.values(streaks).map((s) => s.count));

  const styles = makeStyles(c);

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Hero */}
          <View style={styles.hero}>
            <LevelRing xp={totalXP} size={160} />
            <View style={styles.heroStats}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <AuroraText variant="display" numeric>{totalXP.toLocaleString()}</AuroraText>
                <AuroraText variant="caption" color={c.xp}>XP</AuroraText>
              </View>
              <AuroraText variant="micro" muted style={{ marginTop: 4 }}>
                {`LEVEL ${prog.level} · ${prog.current.toLocaleString()} / ${prog.needed.toLocaleString()} XP`}
              </AuroraText>
              <View style={{ marginTop: 12 }}>
                <XpBar pct={prog.pct} color={c.xp} height={10} />
              </View>
              <View style={styles.statsRow}>
                <StatBox label="THIS WEEK" value={`+${weeklyXP}`} color={c.xp} />
                <StatBox label="BADGES" value={`${badges.length}/${allBadgeIds.length}`} color={c.badge} />
                <StatBox label="BEST STREAK" value={`${bestStreak}🔥`} color={c.streak} />
              </View>
            </View>
          </View>

          {/* Sparkline card */}
          <GlassCard accent={c.xp} style={styles.sparkCard}>
            <SectionLabel color={c.xp}>7-DAY XP</SectionLabel>
            <Sparkline data={xpSpark} color={c.xp} width={280} height={60} />
          </GlassCard>

          {/* Ladder */}
          <SectionLabel>LEVEL LADDER</SectionLabel>
          <GlassCard style={styles.ladderWrap}>
            <LevelLadder currentLevel={prog.level} />
          </GlassCard>

          {/* Tabs */}
          <View style={[styles.tabBar, { borderBottomColor: c.border }]}>
            {SECTIONS.map((s) => {
              const active = section === s.id;
              return (
                <Pressable key={s.id} onPress={() => setSection(s.id)} style={styles.tabBtn}>
                  <Text
                    style={{
                      fontFamily: fonts.bodyMedium,
                      fontSize: fontSizes.sm,
                      color: active ? c.primary : c.textMuted,
                    }}
                  >
                    {s.label}
                  </Text>
                  <View
                    style={{
                      height: 2,
                      marginTop: 6,
                      backgroundColor: active ? c.primary : 'transparent',
                    }}
                  />
                </Pressable>
              );
            })}
          </View>

          {section === 'overview' && (
            <View style={styles.grid}>
              {DOMAIN_META.map((dm) => {
                const score = domainScores[dm.key] ?? 0;
                const history = historyFor(dm.key);
                // Empty/single-entry state — show a flat line at current score
                // so the sparkline is real (not mock) but doesn't overpromise.
                const safeHistory = history.length >= 2 ? history : [score, score];
                return (
                  <View key={dm.key} style={styles.gridCell}>
                    <DomainMiniCard
                      domainKey={dm.key}
                      score={score}
                      delta={deltaFor(dm.key)}
                      history={safeHistory}
                    />
                  </View>
                );
              })}
            </View>
          )}

          {section === 'badges' && (
            <View style={styles.grid}>
              {allBadgeIds.map((id) => (
                <View key={id} style={styles.badgeCell}>
                  <BadgeTile badgeId={id} earned={badges.includes(id)} />
                </View>
              ))}
            </View>
          )}

          {section === 'streaks' && (
            <View style={{ gap: 12 }}>
              {(Object.keys(STREAK_META) as StreakKey[]).map((k) => {
                const s = streaks[k];
                return (
                  <StreakRow
                    key={k}
                    streakKey={k}
                    count={s?.count ?? 0}
                    best={s?.count ?? 0}
                    graceUsed={s?.graceUsed ?? false}
                  />
                );
              })}
            </View>
          )}

          {section === 'quests' && (
            <View style={{ gap: 16 }}>
              <SectionLabel>DAILY QUESTS</SectionLabel>
              <View style={{ gap: 10 }}>
                {quests.filter((q) => q.type === 'daily').map((q) => (
                  <QuestCard key={q.id} quest={q} onPress={() => setOpenQuest(q)} />
                ))}
              </View>
              <SectionLabel>WEEKLY QUEST</SectionLabel>
              <View style={{ gap: 10 }}>
                {quests.filter((q) => q.type === 'weekly').map((q) => (
                  <QuestCard key={q.id} quest={q} onPress={() => setOpenQuest(q)} />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <QuestDetailSheet
        quest={openQuest}
        visible={openQuest !== null}
        onClose={() => setOpenQuest(null)}
        onChanged={() => { if (userId) loadGame(userId); }}
      />
    </View>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  const c = useColors();
  return (
    <View style={[sbStyles.box, { backgroundColor: c.card, borderColor: c.border }]}>
      <AuroraText variant="micro" muted>{label}</AuroraText>
      <AuroraText variant="h3" numeric color={color}>{value}</AuroraText>
    </View>
  );
}

const sbStyles = StyleSheet.create({
  box: { borderRadius: radii.control, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, flex: 1, gap: 2 },
});

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
    hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, flexWrap: 'wrap' },
    heroStats: { flex: 1, minWidth: 200 },
    xpBig: { fontFamily: fonts.heading, fontSize: 36, color: c.textPrimary, lineHeight: 40 },
    statsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
    sparkCard: { borderRadius: 20, borderWidth: 1, padding: 16 },
    sectionLabel: {
      fontFamily: fonts.heading,
      fontSize: 13,
      color: c.textSecondary,
      letterSpacing: 0.5,
    },
    ladderWrap: { borderRadius: 20, borderWidth: 1, padding: 16 },
    tabBar: { flexDirection: 'row', gap: 4, borderBottomWidth: 1 },
    tabBtn: { paddingHorizontal: 12, paddingTop: 8 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    gridCell: { width: '48%', minWidth: 240, flexGrow: 1 },
    badgeCell: { width: '30%', minWidth: 140, flexGrow: 1 },
  });
}
