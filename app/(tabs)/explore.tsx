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
import { EmptyState } from '@/components/ui/EmptyState';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { InterestCard } from '@/components/modules/polymath/InterestCard';
import { AddInterestSheet } from '@/components/modules/polymath/AddInterestSheet';
import { LogExplorationSheet } from '@/components/modules/polymath/LogExplorationSheet';
import { DiscoverGrid, type DiscoverArea } from '@/components/modules/polymath/DiscoverGrid';
import { CrossDisciplineCard } from '@/components/modules/polymath/CrossDisciplineCard';
import { DepthSheet } from '@/components/modules/polymath/DepthSheet';
import { YouTubeImportCard } from '@/components/modules/polymath/YouTubeImportCard';
import { suggestedAreaToDiscoverArea } from '@/components/modules/polymath/discoverArea';
import {
  usePolymathStore,
  suggestionsAreStale,
  crossIsStale,
} from '@/store/usePolymathStore';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import { tickQuestMetric } from '@/store/useQuestStore';
import { useAI } from '@/hooks/useAI';
import { suggestInterestAreas, suggestCrossDisciplineLink, suggestMapTitle } from '@/ai/functions';
import { upsertRabbitHoleTree } from '@/db/queries/rabbitHoleTrees';
import Svg, { Circle as SvgCircle, Line as SvgLine } from 'react-native-svg';
import { logBehaviourEvent } from '@/db/queries/behaviour';
import { XP_VALUES } from '@/utils/gamification';
import type { Interest } from '@/db/queries/interests';
import type { ExplorationDepth, YouTubeImportedInterest } from '@/ai/types';
import { useScreenTracking } from '@/hooks/useScreenTracking';
import { useRouter } from 'expo-router';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { isEnabled } from '@/config/flags';
import { useFlagStore } from '@/store/useFlagStore';
import { SparkHeroCard } from '@/components/modules/polymath/SparkHeroCard';
import { ChasingNowCard } from '@/components/modules/polymath/ChasingNowCard';
import { generateChasingNow, type ChasingSignal, type ChasingThread } from '@/explore/chasing';
import { FrontierCard } from '@/components/modules/polymath/FrontierCard';
import { generateFrontier, type Frontier } from '@/explore/frontier';
import { ExpeditionProgressRow } from '@/components/modules/polymath/ExpeditionProgressRow';
import { ConstellationView } from '@/components/modules/polymath/ConstellationView';
import { generateDailySpark, type Spark } from '@/explore/spark';
import { recordSpark, getSparkByDate, listRecentSparkTitles, updateSparkStatus } from '@/db/queries/sparks';
import { listRabbitHoleTrees, type RabbitHoleTreeRow } from '@/db/queries/rabbitHoleTrees';
import { listExpeditions, listActiveExpeditionProgress, getExpedition as getExpeditionDef, createExpedition, saveExpeditionProgress } from '@/db/queries/expeditions';
import { generateExpedition } from '@/explore/expeditionGen';
import { startExpedition, canStartExpedition, MAX_ACTIVE_EXPEDITIONS } from '@/explore/expeditions';
import { track, EVENTS } from '@/utils/telemetry';
import { nanoid } from '@/utils/id';
import type { ConstellationInput } from '@/explore/constellation';

function MapSilhouette({ treeJson, color }: { treeJson: string; color: string }) {
  const W = 72;
  const H = 48;
  const DOT = 3;

  const positions: { id: string; x: number; y: number }[] = [];
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];

  try {
    const data = JSON.parse(treeJson) as { nodeMap: Record<string, { parentId: string | null }>; rootId: string };
    const { nodeMap, rootId } = data;
    const layers: string[][] = [[rootId]];
    const seen = new Set([rootId]);
    for (let depth = 0; depth < 4; depth++) {
      const next: string[] = [];
      for (const id of layers[layers.length - 1]) {
        for (const [nodeId, node] of Object.entries(nodeMap)) {
          if (node.parentId === id && !seen.has(nodeId)) {
            next.push(nodeId);
            seen.add(nodeId);
          }
        }
      }
      if (next.length === 0) break;
      layers.push(next.slice(0, 6));
    }
    const posMap: Record<string, { x: number; y: number }> = {};
    layers.forEach((layer, depth) => {
      const y = DOT + (depth / Math.max(layers.length - 1, 1)) * (H - DOT * 2);
      layer.forEach((id, i) => {
        const x = ((i + 1) / (layer.length + 1)) * W;
        posMap[id] = { x, y };
        positions.push({ id, x, y });
      });
    });
    for (const [nodeId, node] of Object.entries(nodeMap)) {
      if (node.parentId && posMap[nodeId] && posMap[node.parentId]) {
        const p = posMap[node.parentId];
        const c = posMap[nodeId];
        edges.push({ x1: p.x, y1: p.y, x2: c.x, y2: c.y });
      }
    }
  } catch {}

  return (
    <Svg width={W} height={H}>
      {edges.map((e, i) => (
        <SvgLine key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={color} strokeWidth={1} strokeOpacity={0.35} />
      ))}
      {positions.map((p) => (
        <SvgCircle key={p.id} cx={p.x} cy={p.y} r={DOT} fill={color} fillOpacity={0.65} />
      ))}
    </Svg>
  );
}

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
    log,
    load,
    addInterest,
    addInterests,
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
  const router = useRouter();

  // ─── Explore redesign: "Chasing now" live questions ────────────────────
  const [chasingThreads, setChasingThreads] = useState<ChasingThread[] | null>(null);

  // ─── Explore redesign: "The frontier" — best unexplored edge ────────────
  const [frontier, setFrontier] = useState<Frontier | null>(null);
  const frontierEnabled = useFlagStore((s) => s.isEnabled('explore_frontier'));
  const exploreChasing = useFlagStore((s) => s.isEnabled('explore_chasing'));

  // ─── §12.2: Your Maps history ───────────────────────────────────────────
  const [rabbitHoleTrees, setRabbitHoleTrees] = useState<RabbitHoleTreeRow[]>([]);
  const [suggestingFor, setSuggestingFor] = useState<string | null>(null);

  const handleSuggestTitle = async (row: RabbitHoleTreeRow) => {
    setSuggestingFor(row.id);
    try {
      let anchorTitle = '';
      let sampleNodeTitles: string[] = [];
      try {
        anchorTitle = (JSON.parse(row.anchorJson) as { title?: string }).title ?? '';
        const treeData = JSON.parse(row.treeJson) as { nodeMap?: Record<string, { title?: string }> };
        sampleNodeTitles = Object.values(treeData.nodeMap ?? {})
          .map((n) => n.title ?? '')
          .filter(Boolean)
          .slice(0, 8);
      } catch {}
      const title = await suggestMapTitle({ anchorTitle, sampleNodeTitles });
      if (title) {
        const updated = { ...row, title, updatedAt: new Date().toISOString() };
        upsertRabbitHoleTree(updated);
        setRabbitHoleTrees((prev) => prev.map((r) => r.id === row.id ? updated : r));
      }
    } catch {
      // ignore — user can retry
    } finally {
      setSuggestingFor(null);
    }
  };

  // ─── Explore v2: sparks + expeditions + constellation ──────────────────
  const [todaySpark, setTodaySpark] = useState<Spark | null>(null);
  const [expeditionData, setExpeditionData] = useState<Array<{ expedition: ReturnType<typeof getExpeditionDef> & {}; progress: ReturnType<typeof listActiveExpeditionProgress>[number] }>>([]);
  const constellationInput = useMemo((): ConstellationInput => ({
    interests: interests.map((i) => ({ id: i.id, name: i.name, category: i.category, explorationDepth: i.explorationDepth })),
    sparks: todaySpark && (todaySpark.status === 'saved' || todaySpark.status === 'explored') ? [todaySpark] : [],
    expeditions: expeditionData.map(({ expedition: e, progress: p }) => ({ id: e.id, title: e.title, theme: e.theme, seedSparkId: e.seedSparkId, status: p.status })),
  }), [interests, todaySpark, expeditionData]);

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
      if (!userId) return;
      load(userId);
      // Load today's spark (generate if needed, behind flag)
      if (isEnabled('domainNudges')) {
        const today = format(new Date(), 'yyyy-MM-dd');
        const existing = getSparkByDate(userId, today);
        if (existing) {
          setTodaySpark(existing);
        } else {
          const recentTitles = listRecentSparkTitles(userId, 14);
          const sparkInterests = interests.map((i) => ({ name: i.name, category: i.category }));
          generateDailySpark({ interests: sparkInterests, recentSparkTitles: recentTitles })
            .then((gen) => {
              const spark: Spark = { ...gen, id: nanoid(), userId, date: today, status: 'new', threadId: null, createdAt: new Date().toISOString() };
              recordSpark(spark);
              setTodaySpark(spark);
              track(EVENTS.sparkShown, { seedInterest: gen.seedInterest });
            })
            .catch(() => {}); // non-fatal
        }
      }
      // Load saved rabbit-hole maps
      setRabbitHoleTrees(listRabbitHoleTrees(userId));

      // Load active expeditions
      const progList = listActiveExpeditionProgress(userId);
      const loaded = progList.map((p) => {
        const e = getExpeditionDef(p.expeditionId);
        return e ? { expedition: e, progress: p } : null;
      }).filter((x): x is NonNullable<typeof x> => !!x);
      setExpeditionData(loaded);
    }, [userId, load, interests.length]),
  );

  // Generate "Chasing now" once interests are loaded (once per mount), grounded
  // in the user's real exploration signal — interests + recently-logged sessions
  // (minutes + their own notes). An empty result is valid (thin signal).
  useEffect(() => {
    if (!userId || !exploreChasing) return;
    if (chasingThreads !== null) return;
    if (interests.length === 0) return;
    const idToName = new Map(interests.map((i) => [i.id, i.name] as const));
    const today = new Date();
    const signal: ChasingSignal = {
      interests: interests.map((i) => ({
        name: i.name,
        category: i.category,
        explorationDepth: i.explorationDepth,
      })),
      recentExploration: log
        .filter((e) => differenceInCalendarDays(today, parseISO(e.date)) <= 14)
        .map((e) => ({
          interest: idToName.get(e.interestId) ?? 'unknown',
          minutes: e.minutesSpent,
          notes: e.notes ?? undefined,
          daysAgo: Math.max(0, differenceInCalendarDays(today, parseISO(e.date))),
        })),
    };
    generateChasingNow(signal)
      .then((threads) => {
        setChasingThreads(threads);
        if (threads.length > 0) track(EVENTS.chasingShown, { count: threads.length });
      })
      .catch(() => setChasingThreads([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, interests.length, log.length]);

  // Generate "The frontier" once interests are loaded — the single most fertile
  // unexplored edge between two interests the user already has. Needs at least
  // two interests; a null result (no honest edge) is valid.
  useEffect(() => {
    if (!userId || !frontierEnabled) return;
    if (frontier !== null) return;
    if (interests.length < 2) return;
    const today = new Date();
    const recentById = new Map<string, number>();
    log
      .filter((e) => differenceInCalendarDays(today, parseISO(e.date)) <= 14)
      .forEach((e) => recentById.set(e.interestId, (recentById.get(e.interestId) ?? 0) + e.minutesSpent));
    generateFrontier({
      interests: interests.map((i) => ({
        name: i.name,
        category: i.category,
        explorationDepth: i.explorationDepth,
        recentMinutes: recentById.get(i.id) ?? 0,
      })),
    })
      .then((f) => {
        setFrontier(f);
        if (f) track(EVENTS.frontierShown, { a: f.interestA, b: f.interestB });
      })
      .catch(() => setFrontier(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, frontierEnabled, interests.length, log.length]);

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

  const handleYouTubeImport = (items: YouTubeImportedInterest[]) => {
    if (!userId || items.length === 0) return;
    addInterests(
      items.map((it) => ({
        userId,
        name: it.name,
        category: it.category,
        weeklyMinutesTarget: it.weeklyMinutesTarget,
        discoveredBy: 'youtube',
      })),
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleLog = (data: { minutesSpent: number; notes?: string; date: string }) => {
    if (!userId || !activeInterest) return;
    addExploration({ interestId: activeInterest.id, ...data }, userId);
    logBehaviourEvent('exploration_logged', 'polymath');
    addXP(userId, XP_VALUES.completeGoalTask);
    triggerStreak(userId, 'learning');
    completeBlock(userId, 'polymath', 1, 1);
    advanceQuest('q_learn', 1);
    tickQuestMetric(userId, 'learning_resource', 1);

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

  // ─── Spark actions ─────────────────────────────────────────────────────────
  const [graduating, setGraduating] = useState(false);

  const handleSparkAction = useCallback(async (action: 'save' | 'dismiss' | 'pull_thread' | 'start_expedition') => {
    if (!todaySpark || !userId) return;

    // start_expedition: generate a journey seeded from the spark and navigate.
    if (action === 'start_expedition') {
      const active = listActiveExpeditionProgress(userId);
      if (!canStartExpedition(active.length)) {
        // Soft guard — user-facing cap. Mark spark as seen so we don't loop.
        updateSparkStatus(todaySpark.id, 'seen');
        setTodaySpark({ ...todaySpark, status: 'seen' });
        track(EVENTS.expeditionStarted, { fromSpark: true, blockedByCap: true, capacity: MAX_ACTIVE_EXPEDITIONS });
        return;
      }
      setGraduating(true);
      try {
        const gen = await generateExpedition({
          seedSparkTitle: todaySpark.title,
          seedInterest: todaySpark.seedInterest,
          theme: todaySpark.adjacentField || todaySpark.seedInterest,
        });
        const expeditionId = nanoid();
        createExpedition({
          id: expeditionId,
          userId,
          title: gen.title,
          theme: gen.theme,
          domain: 'polymath',
          steps: gen.steps,
          totalSteps: gen.steps.length,
          source: 'spark',
          seedSparkId: todaySpark.id,
          createdAt: new Date().toISOString(),
        });
        const progress = startExpedition(expeditionId, userId, {
          now: () => new Date().toISOString(),
          newId: () => nanoid(),
        });
        saveExpeditionProgress(progress);
        updateSparkStatus(todaySpark.id, 'explored', expeditionId);
        setTodaySpark({ ...todaySpark, status: 'explored', threadId: expeditionId });
        triggerStreak(userId, 'learning');
        track(EVENTS.expeditionStarted, { fromSpark: true });
        track(EVENTS.curiosityStreakDay, {});
        router.push(`/expedition-detail?id=${expeditionId}`);
      } catch {
        // Generation failed → leave spark untouched; user can retry or pick another action.
      } finally {
        setGraduating(false);
      }
      return;
    }

    // pull_thread: navigate into the rabbit-hole branching view (an in-app journey).
    if (action === 'pull_thread') {
      updateSparkStatus(todaySpark.id, 'explored');
      setTodaySpark({ ...todaySpark, status: 'explored' });
      track(EVENTS.sparkThreadPulled, {});
      triggerStreak(userId, 'learning');
      track(EVENTS.curiosityStreakDay, {});
      router.push(`/rabbit-hole?sparkId=${todaySpark.id}`);
      return;
    }

    // save / dismiss — simple status updates.
    const statusMap: Record<string, Spark['status']> = { save: 'saved', dismiss: 'dismissed' };
    const next = statusMap[action] ?? 'seen';
    updateSparkStatus(todaySpark.id, next);
    setTodaySpark({ ...todaySpark, status: next });
    if (action === 'save') {
      addXP(userId, XP_VALUES.completeGoalTask);
      track(EVENTS.sparkSaved, { domain: 'polymath' });
      triggerStreak(userId, 'learning');
      track(EVENTS.curiosityStreakDay, {});
      tickQuestMetric(userId, 'spark_engaged', 1);
    }
    if (action === 'dismiss') track(EVENTS.sparkDismissed, {});
  }, [todaySpark, userId, addXP, triggerStreak, router]);

  // ─── Chasing-now actions ─────────────────────────────────────────────────────
  const handlePullThread = useCallback((thread: ChasingThread) => {
    if (!userId) return;
    track(EVENTS.chasingThreadPulled, { seedInterest: thread.seedInterest });
    triggerStreak(userId, 'learning');
    track(EVENTS.curiosityStreakDay, {});
    router.push({
      pathname: '/rabbit-hole',
      params: {
        seedTitle: thread.question,
        seedBody: thread.rationale,
        seedInterest: thread.seedInterest,
      },
    });
  }, [userId, router, triggerStreak]);

  const handleDismissThread = useCallback((thread: ChasingThread) => {
    setChasingThreads((prev) => (prev ? prev.filter((t) => t.question !== thread.question) : prev));
  }, []);

  const handleExploreFrontier = useCallback((f: Frontier) => {
    if (!userId) return;
    track(EVENTS.frontierExplored, { a: f.interestA, b: f.interestB });
    triggerStreak(userId, 'learning');
    track(EVENTS.curiosityStreakDay, {});
    router.push({
      pathname: '/rabbit-hole',
      params: {
        seedTitle: f.headline,
        seedBody: f.insight,
        seedInterest: f.interestA,
        seedAdjacent: f.interestB,
      },
    });
  }, [userId, router, triggerStreak]);

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
          <ModuleHeader title="Explore" domain="polymath" color={c.polymath} />

          {/* ─── Explore redesign: Chasing now (live questions) ─── */}
          {exploreChasing && chasingThreads && chasingThreads.length > 0 && (
            <Animated.View entering={FadeInDown.duration(400)}>
              <ChasingNowCard
                threads={chasingThreads}
                onPull={handlePullThread}
                onDismiss={handleDismissThread}
              />
            </Animated.View>
          )}

          {/* ─── Explore v2: Spark hero ─── */}
          {todaySpark && (
            <Animated.View entering={FadeInDown.duration(400)}>
              <SparkHeroCard spark={todaySpark} onAction={handleSparkAction} />
            </Animated.View>
          )}

          {/* ─── Explore v2: Active expeditions ─── */}
          <ExpeditionProgressRow
            expeditions={expeditionData}
            onPress={(expId) => router.push({ pathname: '/expedition-detail', params: { id: expId } })}
          />

          {/* ─── Explore v2: Constellation ─── */}
          <ConstellationView input={constellationInput} />

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

          {/* ─── Explore redesign: The frontier (replaces the Discover grid) ─── */}
          {frontierEnabled && frontier && (
            <Animated.View entering={FadeInDown.duration(400)}>
              <FrontierCard frontier={frontier} onExplore={handleExploreFrontier} />
            </Animated.View>
          )}

          {/* Discover grid — adjacent topics to add. Hidden when the frontier
              (the gap BETWEEN existing interests) is the discovery surface. */}
          {!frontierEnabled && (
            <>
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
            </>
          )}

          {userId && (
            <YouTubeImportCard
              existingInterestNames={interests.map((i) => i.name)}
              onImport={handleYouTubeImport}
            />
          )}

          {/* ─── §12.2: Your Maps gallery ─── */}
          {rabbitHoleTrees.length > 0 && (
            <>
              <View style={[styles.listHeader, { marginTop: spacing.md }]}>
                <Label>YOUR MAPS</Label>
              </View>
              {rabbitHoleTrees.map((row) => {
                let mapTitle = row.title ?? '';
                let nodeCount = 0;
                try {
                  if (!mapTitle) mapTitle = (JSON.parse(row.anchorJson) as { title?: string }).title ?? '';
                  nodeCount = Object.keys((JSON.parse(row.treeJson) as { nodeMap?: Record<string, unknown> }).nodeMap ?? {}).length;
                } catch {}
                const isNamed = !!mapTitle;
                const isSuggesting = suggestingFor === row.id;
                return (
                  <Animated.View key={row.id} entering={FadeInDown.duration(300)}>
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        router.push({ pathname: '/rabbit-hole', params: { treeId: row.id } });
                      }}
                    >
                      <Card moduleColor={c.polymath} style={styles.mapCard}>
                        <View style={styles.mapCardRow}>
                          <MapSilhouette treeJson={row.treeJson} color={c.polymath} />
                          <View style={styles.mapCardInfo}>
                            <Body
                              numberOfLines={1}
                              style={!isNamed ? { color: c.textMuted, fontStyle: 'italic' } : undefined}
                            >
                              {mapTitle || 'Untitled map'}
                            </Body>
                            <Caption style={{ color: c.textMuted }}>
                              {nodeCount} node{nodeCount === 1 ? '' : 's'} · {row.createdAt.slice(0, 10)}
                            </Caption>
                            {!isNamed && (
                              <Pressable
                                onPress={() => { Haptics.selectionAsync().catch(() => {}); handleSuggestTitle(row); }}
                                hitSlop={8}
                                disabled={isSuggesting}
                              >
                                <Caption style={{ color: isSuggesting ? c.textMuted : c.polymath, marginTop: 2 }}>
                                  {isSuggesting ? 'Naming…' : 'Suggest name →'}
                                </Caption>
                              </Pressable>
                            )}
                          </View>
                        </View>
                      </Card>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </>
          )}

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
            <EmptyState
              icon="compass-outline"
              title="Nothing to explore yet"
              caption="Add an interest you want to spend time on each week — a skill, hobby, or topic."
              accent={c.polymath}
            />
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
  mapCard: {
    gap: spacing.xs,
  },
  mapCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  mapCardInfo: {
    flex: 1,
    gap: 2,
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
