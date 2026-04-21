import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { useGameStore } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { xpProgressInLevel } from '@/utils/gamification';
import { BADGE_META, DOMAIN_META, STREAK_META, type StreakKey } from '@/constants/gamification';
import { LevelRing } from '@/components/gamification/LevelRing';
import { XpBar } from '@/components/gamification/XpBar';
import { Sparkline } from '@/components/gamification/Sparkline';
import { LevelLadder } from '@/components/gamification/LevelLadder';
import { BadgeTile } from '@/components/gamification/BadgeTile';
import { StreakRow } from '@/components/gamification/StreakRow';
import { QuestCard } from '@/components/gamification/QuestCard';
import { DomainMiniCard } from '@/components/gamification/DomainMiniCard';
import type { BadgeId } from '@/utils/gamification';

type Section = 'overview' | 'badges' | 'streaks' | 'quests';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'badges', label: 'Badges' },
  { id: 'streaks', label: 'Streaks' },
  { id: 'quests', label: 'Quests' },
];

const MOCK_HISTORY = [180, 220, 95, 310, 270, 180, 340];

export default function RewardsScreen() {
  const c = useColors();
  const { userId } = useUserStore();
  const loadGame = useGameStore((s) => s.loadFromDB);
  const totalXP = useGameStore((s) => s.totalXP);
  const weeklyXP = useGameStore((s) => s.weeklyXP);
  const badges = useGameStore((s) => s.badges);
  const streaks = useGameStore((s) => s.streaks);
  const domainScores = useGameStore((s) => s.domainScores);
  const quests = useGameStore((s) => s.quests);
  const [section, setSection] = useState<Section>('overview');

  useFocusEffect(
    useCallback(() => {
      if (userId) loadGame(userId);
    }, [userId, loadGame]),
  );

  const prog = useMemo(() => xpProgressInLevel(totalXP), [totalXP]);
  const allBadgeIds = Object.keys(BADGE_META) as BadgeId[];
  const bestStreak = Math.max(0, ...Object.values(streaks).map((s) => s.count));

  const styles = makeStyles(c);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Hero */}
          <View style={styles.hero}>
            <LevelRing xp={totalXP} size={160} />
            <View style={styles.heroStats}>
              <Text style={styles.xpBig}>
                {totalXP.toLocaleString()}
                <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 16, color: c.xp }}> XP</Text>
              </Text>
              <Text style={{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: c.textSecondary, marginTop: 2 }}>
                Level {prog.level} · {prog.current.toLocaleString()} / {prog.needed.toLocaleString()} XP
              </Text>
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
          <View style={[styles.sparkCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={{ fontFamily: fonts.heading, fontSize: 11, color: c.textMuted, letterSpacing: 0.5, marginBottom: 8 }}>
              7-DAY XP
            </Text>
            <Sparkline data={MOCK_HISTORY} color={c.xp} width={280} height={60} />
          </View>

          {/* Ladder */}
          <Text style={styles.sectionLabel}>LEVEL LADDER</Text>
          <View style={[styles.ladderWrap, { backgroundColor: c.card, borderColor: c.border }]}>
            <LevelLadder currentLevel={prog.level} />
          </View>

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
              {DOMAIN_META.map((dm) => (
                <View key={dm.key} style={styles.gridCell}>
                  <DomainMiniCard
                    domainKey={dm.key}
                    score={domainScores[dm.key] ?? 0}
                    delta={0}
                    history={MOCK_HISTORY}
                  />
                </View>
              ))}
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
              <Text style={styles.sectionLabel}>DAILY QUESTS</Text>
              <View style={{ gap: 10 }}>
                {quests.filter((q) => q.type === 'daily').map((q) => (
                  <QuestCard key={q.id} quest={q} />
                ))}
              </View>
              <Text style={styles.sectionLabel}>WEEKLY QUEST</Text>
              <View style={{ gap: 10 }}>
                {quests.filter((q) => q.type === 'weekly').map((q) => (
                  <QuestCard key={q.id} quest={q} />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  const c = useColors();
  return (
    <View style={[sbStyles.box, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={{ fontFamily: fonts.body, fontSize: 10, color: c.textMuted, letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ fontFamily: fonts.heading, fontSize: 18, color }}>{value}</Text>
    </View>
  );
}

const sbStyles = StyleSheet.create({
  box: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, flex: 1 },
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
