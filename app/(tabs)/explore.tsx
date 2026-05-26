import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { Card } from '@/components/ui/Card';
import { Body, Heading, Label, Caption } from '@/components/ui/Typography';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { InterestCard } from '@/components/modules/polymath/InterestCard';
import { AddInterestSheet } from '@/components/modules/polymath/AddInterestSheet';
import { LogExplorationSheet } from '@/components/modules/polymath/LogExplorationSheet';
import { DiscoverGrid, type DiscoverArea } from '@/components/modules/polymath/DiscoverGrid';
import { CrossDisciplineCard } from '@/components/modules/polymath/CrossDisciplineCard';
import { DepthSheet } from '@/components/modules/polymath/DepthSheet';
import { suggestedAreaToDiscoverArea } from '@/components/modules/polymath/discoverArea';
import {
  usePolymathStore,
  suggestionsAreStale,
  crossIsStale,
} from '@/store/usePolymathStore';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import { useAI } from '@/hooks/useAI';
import { suggestInterestAreas, suggestCrossDisciplineLink } from '@/ai/functions';
import { logBehaviourEvent } from '@/db/queries/behaviour';
import { XP_VALUES } from '@/utils/gamification';
import type { Interest } from '@/db/queries/interests';
import type { ExplorationDepth } from '@/ai/types';
import { useScreenTracking } from '@/hooks/useScreenTracking';

function pairKeyFor(a: Interest, b: Interest): string {
  // Stable, order-independent key so refreshes don't churn when interests
  // are re-loaded in a different order.
  return [a.id, b.id].sort().join('::');
}

function pickPair(interests: Interest[]): [Interest, Interest] | null {
  const active = interests.filter((i) => i.status === 'active' || i.status === 'exploring');
  if (active.length < 2) return null;
  // Prefer two interests from different categories — more interesting links.
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      if (active[i].category !== active[j].category) return [active[i], active[j]];
    }
  }
  return [active[0], active[1]];
}

export default function ExploreScreen() {
  useScreenTracking('explore');
  const c = useColors();
  const { userId } = useUserStore();
  const {
    interests,
    load,
    addInterest,
    editInterest,
    removeInterest,
    addExploration,
    weeklyMinutes,
    suggestions,
    setSuggestions,
    cross,
    setCross,
  } = usePolymathStore();
  const { addXP, triggerStreak, completeBlock, awardBadge } = useGameStore();
  const advanceQuest = useGameStore((s) => s.advanceQuest);

  const [showAdd, setShowAdd] = useState(false);
  const [seed, setSeed] = useState<{ name?: string; category?: DiscoverArea['category'] } | undefined>(undefined);
  const [activeInterest, setActiveInterest] = useState<Interest | null>(null);
  const [depthFor, setDepthFor] = useState<Interest | null>(null);

  const { call: callSuggestions, loading: suggestionsLoading } = useAI();
  const { call: callCross, loading: crossLoading } = useAI();

  const handlePickArea = (area: DiscoverArea) => {
    setSeed({ name: area.name, category: area.category });
    setShowAdd(true);
  };

  const handleCloseAdd = () => {
    setShowAdd(false);
    setSeed(undefined);
  };

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

  // Refresh AI suggestions when the user's interest set changes or cache is stale.
  const activeInterestIds = useMemo(
    () => interests.filter((i) => i.status !== 'deleted').map((i) => i.id),
    [interests],
  );

  const fetchSuggestions = useCallback(async () => {
    const existingInterests = interests
      .filter((i) => i.status !== 'deleted')
      .map((i) => ({ name: i.name, category: i.category }));
    const result = await callSuggestions(() => suggestInterestAreas({ existingInterests }));
    if (result) setSuggestions(result.areas, activeInterestIds);
  }, [interests, activeInterestIds, callSuggestions, setSuggestions]);

  useEffect(() => {
    if (!userId) return;
    if (suggestionsAreStale(suggestions, activeInterestIds)) {
      void fetchSuggestions();
    }
    // We intentionally trigger only when the set of interests changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, activeInterestIds.join(',')]);

  // Cross-discipline pair: refresh when the active pair changes.
  const pair = useMemo(() => pickPair(interests), [interests]);
  const currentPairKey = pair ? pairKeyFor(pair[0], pair[1]) : '';

  const fetchCross = useCallback(async () => {
    if (!pair) return;
    const [a, b] = pair;
    const result = await callCross(() =>
      suggestCrossDisciplineLink({
        interestA: { name: a.name, category: a.category },
        interestB: { name: b.name, category: b.category },
      }),
    );
    if (result) setCross(result, pairKeyFor(a, b));
  }, [pair, callCross, setCross]);

  useEffect(() => {
    if (!pair) return;
    if (crossIsStale(cross, currentPairKey)) {
      void fetchCross();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPairKey]);

  // ─── Mutations ─────────────────────────────────────────────────────────────

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
    advanceQuest('q_learn', 1);

    // Polymath Starter: first log on a deep_dive interest.
    if (activeInterest.explorationDepth === 'deep_dive') {
      awardBadge(userId, 'polymath_starter');
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDelete = (id: string) => {
    if (!userId) return;
    removeInterest(id, userId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleToggleProtect = (interest: Interest) => {
    if (!userId) return;
    editInterest(interest.id, { timeProtected: !interest.timeProtected }, userId);
    Haptics.selectionAsync();
  };

  const handlePickDepth = (depth: ExplorationDepth, suggestedMinutes: number) => {
    if (!userId || !depthFor) return;
    // Only bump the target up — never silently shrink an existing target.
    const target = Math.max(depthFor.weeklyMinutesTarget, suggestedMinutes);
    editInterest(
      depthFor.id,
      { explorationDepth: depth, weeklyMinutesTarget: target },
      userId,
    );
    setDepthFor(null);
    Haptics.selectionAsync();
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const discoverAreas = useMemo(
    () => (suggestions ? suggestions.areas.map(suggestedAreaToDiscoverArea) : undefined),
    [suggestions],
  );

  const pairLabel = pair ? `${pair[0].name} × ${pair[1].name}` : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <AuroraBackground />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <ModuleHeader title="Explore" icon="compass" color={c.polymath} />

          <Animated.View entering={FadeInDown.duration(400)}>
            <Card moduleColor={c.polymath} style={styles.summary}>
              <Label color={c.polymath}>THIS WEEK</Label>
              <Heading style={styles.summaryNumber}>{totalMinutesWeek} min</Heading>
              <Caption>across {interests.length} interest{interests.length === 1 ? '' : 's'}</Caption>
            </Card>
          </Animated.View>

          {pair ? (
            <CrossDisciplineCard
              link={cross?.link ?? null}
              loading={crossLoading}
              pairLabel={pairLabel}
              onRefresh={fetchCross}
            />
          ) : null}

          <View style={styles.listHeader}>
            <Label>DISCOVER</Label>
            <Pressable onPress={fetchSuggestions} hitSlop={6}>
              <Ionicons
                name="refresh"
                size={16}
                color={suggestionsLoading ? c.textMuted : c.polymath}
              />
            </Pressable>
          </View>
          {suggestions && discoverAreas ? (
            <Caption style={{ color: c.textMuted }}>
              Personalised from your {suggestions.basedOnInterestIds.length} active interests.
            </Caption>
          ) : suggestionsLoading ? (
            <Caption style={{ color: c.textMuted }}>Generating suggestions…</Caption>
          ) : null}
          <DiscoverGrid onPick={handlePickArea} areas={discoverAreas} />

          <View style={styles.listHeader}>
            <Label>YOUR INTERESTS</Label>
            <Pressable
              onPress={() => setShowAdd(true)}
              style={[styles.addBtn, { backgroundColor: c.polymathLight }]}
            >
              <Ionicons name="add" size={18} color={c.polymath} />
              <Label color={c.polymath}>Add</Label>
            </Pressable>
          </View>

          {interests.length === 0 ? (
            <Card style={styles.empty}>
              <Ionicons name="compass-outline" size={32} color={c.textMuted} />
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
                  onEditDepth={() => setDepthFor(interest)}
                  onToggleProtect={() => handleToggleProtect(interest)}
                />
              </Animated.View>
            ))
          )}
        </ScrollView>

        <AddInterestSheet
          visible={showAdd}
          onClose={handleCloseAdd}
          onAdd={handleAdd}
          seed={seed}
        />
        <LogExplorationSheet
          visible={!!activeInterest}
          interestName={activeInterest?.name ?? ''}
          onClose={() => setActiveInterest(null)}
          onLog={handleLog}
        />
        <DepthSheet
          visible={!!depthFor}
          current={(depthFor?.explorationDepth as ExplorationDepth) ?? 'taste'}
          onClose={() => setDepthFor(null)}
          onPick={handlePickDepth}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
});
