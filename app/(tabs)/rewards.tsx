// ─── Rewards Tab ─────────────────────────────────────────────────────────────
// Hero band (LevelRing + XP stats + sparkline), level ladder, tabbed sections
// for domain overview / badges / streaks / quests.

import { useMemo, useState } from 'react';
import { View, ScrollView, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { useGameStore } from '@/store/useGameStore';
import {
  xpProgressInLevel,
  xpForLevel,
  BADGE_META,
  STREAK_META,
  DOMAIN_META,
  LEVEL_PERKS,
  BadgeId,
} from '@/utils/gamification';
import { LevelRing } from '@/components/gamification/LevelRing';
import { XPBar } from '@/components/gamification/XPBar';
import { Sparkline } from '@/components/gamification/Sparkline';
import { BadgeCard } from '@/components/gamification/BadgeCard';
import { DomainMiniCard } from '@/components/gamification/DomainMiniCard';
import { QuestCard } from '@/components/gamification/QuestCard';
import { StreakFlame } from '@/components/gamification/StreakFlame';

type Section = 'overview' | 'badges' | 'streaks' | 'quests';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'badges',   label: 'Badges'   },
  { id: 'streaks',  label: 'Streaks'  },
  { id: 'quests',   label: 'Quests'   },
];

export default function RewardsScreen() {
  const c = useColors();
  const totalXP   = useGameStore((s) => s.totalXP);
  const weeklyXP  = useGameStore((s) => s.weeklyXP);
  const badges    = useGameStore((s) => s.badges);
  const streaks   = useGameStore((s) => s.streaks);
  const scores    = useGameStore((s) => s.domainScores);
  const quests    = useGameStore((s) => s.quests);

  const [section, setSection] = useState<Section>('overview');
  const prog = xpProgressInLevel(totalXP);

  // 7-day XP history placeholder — rolling weekly history isn't persisted yet,
  // so we synthesise a lightweight default from weeklyXP. A future change can
  // pull real per-day totals from behaviour_events.
  const xpHistory = useMemo(() => {
    const base = Math.max(20, Math.round(weeklyXP / 7));
    return [base, base + 20, base - 15, base + 30, base - 5, base + 10, base + 40];
  }, [weeklyXP]);

  const allBadgeIds = Object.keys(BADGE_META) as BadgeId[];
  const earnedSet = new Set(badges);

  const bestStreak = useMemo(() => {
    let max = 0;
    Object.values(streaks).forEach((s) => { if (s.count > max) max = s.count; });
    return max;
  }, [streaks]);

  const styles = makeStyles(c);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
          {/* Hero */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.hero}>
            <View style={styles.heroRing}>
              <LevelRing xp={totalXP} size={180} />
            </View>
            <View style={styles.heroStats}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={[styles.heroXP, { color: c.textPrimary, fontFamily: fonts.display }]}>
                  {totalXP.toLocaleString()}
                </Text>
                <Text style={[styles.heroXPUnit, { color: c.xp, fontFamily: fonts.bodyMedium }]}> XP</Text>
              </View>
              <Text style={[styles.heroSub, { color: c.textSecondary, fontFamily: fonts.body }]}>
                Level {prog.level} · {prog.current.toLocaleString()} / {prog.needed.toLocaleString()} XP to next level
              </Text>
              <XPBar pct={prog.pct} color={c.xp} height={12} />
              <View style={styles.statChipRow}>
                <StatChip label="THIS WEEK" value={`+${weeklyXP}`} color={c.xp} />
                <StatChip label="BADGES" value={`${badges.length}/${allBadgeIds.length}`} color={c.badge} />
                <StatChip label="BEST STREAK" value={`${bestStreak}🔥`} color={c.streak} />
              </View>
            </View>
          </Animated.View>

          {/* Sparkline card */}
          <View style={[styles.sparkCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.sparkLabel, { color: c.textMuted, fontFamily: fonts.body }]}>
              7-DAY XP
            </Text>
            <Sparkline data={xpHistory} color={c.xp} width={240} height={60} />
            <View style={styles.sparkFooter}>
              <Text style={[styles.sparkFoot, { color: c.textMuted }]}>Mon</Text>
              <Text style={[styles.sparkFoot, { color: c.textMuted }]}>Sun</Text>
            </View>
          </View>

          {/* Level Ladder */}
          <View>
            <Text style={[styles.sectionTitle, { color: c.textSecondary, fontFamily: fonts.heading }]}>
              LEVEL LADDER
            </Text>
            <View style={[styles.ladderCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingHorizontal: 8 }}>
                  {[prog.level, prog.level + 1, prog.level + 2, prog.level + 3, prog.level + 4].map((lvl) => (
                    <LadderStep
                      key={lvl}
                      level={lvl}
                      isCurrent={lvl === prog.level}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>

          {/* Tabs */}
          <View style={[styles.tabBar, { borderColor: c.border }]}>
            {SECTIONS.map((s) => {
              const active = section === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setSection(s.id)}
                  style={[
                    styles.tab,
                    active && { borderBottomColor: c.primary },
                  ]}
                >
                  <Text
                    style={{
                      fontFamily: fonts.bodyMedium,
                      fontWeight: '600',
                      fontSize: 14,
                      color: active ? c.primary : c.textMuted,
                    }}
                  >
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Section content */}
          {section === 'overview' && (
            <View>
              <Text style={[styles.sectionTitle, { color: c.textSecondary, fontFamily: fonts.heading }]}>
                DOMAIN SCORES
              </Text>
              <View style={styles.grid}>
                {DOMAIN_META.map((dm) => {
                  const score = scores[dm.key] ?? 0;
                  return (
                    <View key={dm.key} style={styles.gridCell}>
                      <DomainMiniCard
                        domainKey={dm.key}
                        score={score}
                        delta={0}
                        xpHistory={xpHistory}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {section === 'badges' && (
            <View>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: c.textSecondary, fontFamily: fonts.heading }]}>
                  BADGE GALLERY
                </Text>
                <Text style={{ color: c.textMuted, fontFamily: fonts.body, fontSize: 13 }}>
                  {badges.length} of {allBadgeIds.length} earned
                </Text>
              </View>
              <View style={styles.grid}>
                {allBadgeIds.map((id) => (
                  <View key={id} style={styles.badgeCell}>
                    <BadgeCard badgeId={id} earned={earnedSet.has(id)} />
                  </View>
                ))}
              </View>
            </View>
          )}

          {section === 'streaks' && (
            <View>
              <Text style={[styles.sectionTitle, { color: c.textSecondary, fontFamily: fonts.heading }]}>
                STREAK SHOWCASE
              </Text>
              <View style={{ gap: spacing.sm }}>
                {(Object.entries(streaks) as [keyof typeof streaks, typeof streaks[keyof typeof streaks]][]).map(([key, streak]) => {
                  const meta = STREAK_META[key];
                  const color = (c as unknown as Record<string, string>)[meta.colorKey] ?? c.primary;
                  const pct = Math.min(1, streak.count / 30);
                  const daysLeft = Math.max(0, 30 - streak.count);
                  return (
                    <View
                      key={key}
                      style={[
                        styles.streakCard,
                        { backgroundColor: c.card, borderColor: color + '33' },
                      ]}
                    >
                      <View style={styles.streakHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 16 }}>{meta.emoji}</Text>
                          <Text style={{ color: c.textPrimary, fontFamily: fonts.bodyMedium, fontSize: 15, fontWeight: '600' }}>
                            {meta.label}
                          </Text>
                          {streak.graceUsed && (
                            <View style={[styles.graceBadge, { backgroundColor: c.warning + '22' }]}>
                              <Text style={{ color: c.warning, fontSize: 10, fontFamily: fonts.bodyMedium, fontWeight: '600' }}>
                                GRACE
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                          <StreakFlame
                            count={streak.count}
                            graceUsed={streak.graceUsed}
                            size={streak.count >= 20 ? 'lg' : streak.count >= 10 ? 'md' : 'sm'}
                          />
                        </View>
                      </View>
                      <XPBar pct={pct} color={color} height={6} />
                      <Text style={{ color: c.textMuted, fontFamily: fonts.body, fontSize: 11, marginTop: 4 }}>
                        Best: {streak.count >= 1 ? Math.max(streak.count, streak.count) : 0} · {daysLeft} days to 30-day badge
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {section === 'quests' && (
            <View>
              <Text style={[styles.sectionTitle, { color: c.textSecondary, fontFamily: fonts.heading }]}>
                DAILY QUESTS
              </Text>
              <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
                {quests.filter((q) => q.type === 'daily').map((q) => (
                  <QuestCard key={q.id} quest={q} />
                ))}
              </View>
              <Text style={[styles.sectionTitle, { color: c.textSecondary, fontFamily: fonts.heading }]}>
                WEEKLY QUEST
              </Text>
              <View style={{ gap: spacing.sm }}>
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

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  const c = useColors();
  return (
    <View style={[chipStyles.chip, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={[chipStyles.label, { color: c.textMuted, fontFamily: fonts.body }]}>{label}</Text>
      <Text style={[chipStyles.value, { color, fontFamily: fonts.display }]}>{value}</Text>
    </View>
  );
}

function LadderStep({ level, isCurrent }: { level: number; isCurrent: boolean }) {
  const c = useColors();
  const perks = LEVEL_PERKS[level] ?? [];
  const xp = xpForLevel(level);

  return (
    <View style={ladderStyles.step}>
      <View
        style={[
          ladderStyles.orb,
          {
            width: isCurrent ? 72 : 56,
            height: isCurrent ? 72 : 56,
            borderRadius: 36,
            backgroundColor: isCurrent ? c.primary : c.card,
            borderColor: isCurrent ? c.primary : c.border,
            shadowColor: isCurrent ? c.primary : undefined,
            shadowOpacity: isCurrent ? 0.5 : 0,
            shadowRadius: isCurrent ? 12 : 0,
            shadowOffset: { width: 0, height: 0 },
            elevation: isCurrent ? 8 : 0,
          },
        ]}
      >
        <Text
          style={{
            fontFamily: fonts.display,
            fontWeight: '800',
            fontSize: isCurrent ? 22 : 17,
            color: isCurrent ? '#FFFFFF' : c.textMuted,
          }}
        >
          {level}
        </Text>
        {isCurrent && (
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 9, fontFamily: fonts.body }}>YOU</Text>
        )}
      </View>
      <View
        style={[
          ladderStyles.perkBox,
          { backgroundColor: c.card, borderColor: isCurrent ? c.primary + '44' : c.border },
        ]}
      >
        <Text style={[ladderStyles.perkHeader, { color: c.textMuted, fontFamily: fonts.heading }]}>
          LVL {level} PERKS
        </Text>
        {perks.length > 0 ? (
          perks.map((p, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <View
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: isCurrent ? c.primary : c.textMuted,
                }}
              />
              <Text
                numberOfLines={2}
                style={{
                  fontFamily: fonts.body,
                  fontSize: 12,
                  color: isCurrent ? c.textPrimary : c.textSecondary,
                  flexShrink: 1,
                }}
              >
                {p}
              </Text>
            </View>
          ))
        ) : (
          <Text style={{ color: c.textMuted, fontFamily: fonts.body, fontSize: 12 }}>Perks unlocking soon</Text>
        )}
        <Text style={{ color: c.textMuted, fontFamily: fonts.body, fontSize: 10, marginTop: 8 }}>
          {xp.toLocaleString()} XP required
        </Text>
      </View>
    </View>
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
      paddingTop: spacing.md,
      gap: spacing.lg,
    },
    hero: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.lg,
    },
    heroRing: {
      flexShrink: 0,
    },
    heroStats: {
      flex: 1,
      minWidth: 220,
      gap: spacing.sm,
    },
    heroXP: {
      fontSize: 40,
      fontWeight: '800',
      lineHeight: 44,
    },
    heroXPUnit: {
      fontSize: 18,
      fontWeight: '600',
      marginLeft: 8,
    },
    heroSub: {
      fontSize: 13,
      marginBottom: 6,
    },
    statChipRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      flexWrap: 'wrap',
      marginTop: spacing.xs,
    },
    sparkCard: {
      borderWidth: 1,
      borderRadius: 20,
      paddingHorizontal: 24,
      paddingVertical: 20,
      alignItems: 'center',
    },
    sparkLabel: {
      fontSize: 11,
      letterSpacing: 0.5,
      marginBottom: 10,
      alignSelf: 'flex-start',
    },
    sparkFooter: {
      width: 240,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    sparkFoot: {
      fontFamily: fonts.body,
      fontSize: 10,
    },
    ladderCard: {
      borderWidth: 1,
      borderRadius: 20,
      paddingVertical: 20,
    },
    sectionTitle: {
      fontFamily: fonts.heading,
      fontWeight: '700',
      fontSize: 13,
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      gap: 8,
    },
    tab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
      marginBottom: -1,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    gridCell: {
      flexGrow: 1,
      flexBasis: 280,
    },
    badgeCell: {
      flexGrow: 1,
      flexBasis: 160,
      maxWidth: 220,
    },
    streakCard: {
      borderWidth: 1,
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: spacing.xs,
    },
    streakHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    graceBadge: {
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 1,
      marginLeft: 6,
    },
  });
}

const chipStyles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
  },
});

const ladderStyles = StyleSheet.create({
  step: {
    alignItems: 'center',
    gap: 10,
    width: 160,
  },
  orb: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkBox: {
    width: 160,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  perkHeader: {
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
});
