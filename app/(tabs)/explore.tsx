import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { MOTION_BUDGET, useMotionScale, useStaggerDelay } from '@/theme/motion';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { Card } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Skeleton } from '@/components/ui/Skeleton';
import { Body, Caption } from '@/components/ui/Typography';
import { EmptyState } from '@/components/ui/EmptyState';
import { InkCanvas } from '@/components/shared/InkCanvas';
import { InterestCard } from '@/components/modules/polymath/InterestCard';
import { AddInterestSheet } from '@/components/modules/polymath/AddInterestSheet';
import { LogExplorationSheet } from '@/components/modules/polymath/LogExplorationSheet';
import { CrossDisciplineCard } from '@/components/modules/polymath/CrossDisciplineCard';
import { DepthSheet } from '@/components/modules/polymath/DepthSheet';
import { YouTubeImportCard } from '@/components/modules/polymath/YouTubeImportCard';
import { ExploreActionSheet } from '@/components/modules/polymath/ExploreActionSheet';
import { FreeExploreSheet } from '@/components/modules/polymath/FreeExploreSheet';
import { usePolymathStore, crossIsStale } from '@/store/usePolymathStore';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import { tickQuestMetric } from '@/store/useQuestStore';
import { useAI } from '@/hooks/useAI';
import { useExploreLauncher } from '@/hooks/useExploreLauncher';
import { suggestCrossDisciplineLink, suggestMapTitle } from '@/ai/functions';
import { upsertRabbitHoleTree } from '@/db/queries/rabbitHoleTrees';
import Svg, { Circle as SvgCircle, Line as SvgLine } from 'react-native-svg';
import { logBehaviourEvent } from '@/db/queries/behaviour';
import { XP_VALUES } from '@/utils/gamification';
import type { Interest } from '@/db/queries/interests';
import type { ExplorationDepth, YouTubeImportedInterest } from '@/ai/types';
import { useScreenTracking } from '@/hooks/useScreenTracking';
import { useRouter } from 'expo-router';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { useFlagStore } from '@/store/useFlagStore';
import { SparkHeroCard } from '@/components/modules/polymath/SparkHeroCard';
import { ChasingNowCard } from '@/components/modules/polymath/ChasingNowCard';
import { WeekStatLine } from '@/components/modules/polymath/WeekStatLine';
import { generateChasingNow, type ChasingSignal, type ChasingThread } from '@/explore/chasing';
import { FrontierCard } from '@/components/modules/polymath/FrontierCard';
import {
  frontierPairKey,
  generateFrontier,
  type Frontier,
  type FrontierConstraints,
  type FrontierSignal,
} from '@/explore/frontier';
import { ExpeditionProgressRow } from '@/components/modules/polymath/ExpeditionProgressRow';
import {
  ConstellationView,
  constellationInputNodeCount,
  CONSTELLATION_MIN_NODES,
} from '@/components/modules/polymath/ConstellationView';
import { generateDailySpark, type Spark } from '@/explore/spark';
import { recordSpark, getSparkByDate, listRecentSparkTitles, updateSparkStatus } from '@/db/queries/sparks';
import { listRabbitHoleTrees, type RabbitHoleTreeRow } from '@/db/queries/rabbitHoleTrees';
import { listActiveExpeditionProgress, getExpedition as getExpeditionDef, createExpedition, saveExpeditionProgress } from '@/db/queries/expeditions';
import { generateExpedition } from '@/explore/expeditionGen';
import { startExpedition, canStartExpedition, MAX_ACTIVE_EXPEDITIONS } from '@/explore/expeditions';
import { track, EVENTS } from '@/utils/telemetry';
import { nanoid } from '@/utils/id';
import type { ConstellationInput } from '@/explore/constellation';

// §3.2 hero fallback chain: the skeleton never lives forever — generation is
// raced against this timeout, after which the slot re-resolves down the chain.
const SPARK_TIMEOUT_MS = 10_000;

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
        const ch = posMap[nodeId];
        edges.push({ x1: p.x, y1: p.y, x2: ch.x, y2: ch.y });
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

// Ink + Signal §3.0.1: module_hierarchy_v1 graduated (100% since 2026-06-13;
// legacy tree deleted per docs/PARKED_ITEMS.md §13.1). Hero-first is the only path.
export default function ExploreScreen() {
  return <ExploreScreenV1 />;
}

function ExploreScreenV1() {
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
    cross,
    setCross,
  } = usePolymathStore();
  const { addXP, triggerStreak, completeBlock, awardBadge } = useGameStore();
  const advanceQuest = useGameStore((s) => s.advanceQuest);

  const [showAdd, setShowAdd] = useState(false);
  const [activeInterest, setActiveInterest] = useState<Interest | null>(null);
  const [depthFor, setDepthFor] = useState<Interest | null>(null);
  const [exploreFor, setExploreFor] = useState<Interest | null>(null);
  const [freeExplore, setFreeExplore] = useState(false);
  const pickToExplore = useFlagStore((s) => s.isEnabled('explore_pick_to_explore'));
  const launcher = useExploreLauncher();

  const { call: callCross, loading: crossLoading } = useAI();
  const router = useRouter();

  // §3.0.6 motion contract: one hero-budget entry, tight stagger on the
  // supporting cast, all durations scaled so reduce-motion lands in one frame.
  const motionScale = useMotionScale();
  const stagger = useStaggerDelay();
  const scaled = (base: number) => (motionScale === 0 ? 0 : base / motionScale);

  // ─── "Chasing now" live questions ────────────────────────────────────────
  const [chasingThreads, setChasingThreads] = useState<ChasingThread[] | null>(null);

  // ─── "The frontier" — best unexplored edge ───────────────────────────────
  const [frontier, setFrontier] = useState<Frontier | null>(null);
  const [frontierBusy, setFrontierBusy] = useState(false);
  // Pairs already shown this session — shuffle excludes them so it feels like
  // a genuine re-roll, not a coin flip that keeps landing the same way.
  const seenFrontierPairs = useRef<Array<[string, string]>>([]);
  const frontierEnabled = useFlagStore((s) => s.isEnabled('explore_frontier'));
  // Frontier controls (shuffle / regenerate / pick endpoints / solo). On by
  // default; a `false` row in the Worker flags table is the remote kill switch.
  const frontierControls = useFlagStore((s) => s.getFlag('frontier_controls', true));
  const exploreChasing = useFlagStore((s) => s.isEnabled('explore_chasing'));

  // ─── §12.2: Your Maps history ────────────────────────────────────────────
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

  // ─── Sparks + expeditions + constellation ────────────────────────────────
  const [todaySpark, setTodaySpark] = useState<Spark | null>(null);
  const [sparkPending, setSparkPending] = useState(false);
  const [expeditionData, setExpeditionData] = useState<Array<{ expedition: ReturnType<typeof getExpeditionDef> & {}; progress: ReturnType<typeof listActiveExpeditionProgress>[number] }>>([]);
  const constellationInput = useMemo((): ConstellationInput => ({
    interests: interests.map((i) => ({ id: i.id, name: i.name, category: i.category, explorationDepth: i.explorationDepth })),
    sparks: todaySpark && (todaySpark.status === 'saved' || todaySpark.status === 'explored') ? [todaySpark] : [],
    expeditions: expeditionData.map(({ expedition: e, progress: p }) => ({ id: e.id, title: e.title, theme: e.theme, seedSparkId: e.seedSparkId, status: p.status })),
  }), [interests, todaySpark, expeditionData]);

  const handleCloseAdd = () => setShowAdd(false);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      load(userId);
      // §3.2 gating change: spark load/generation runs when
      // `isEnabled('domainNudges') || hierarchyV1` — this tree only renders
      // with module_hierarchy_v1 on, so the disjunction is true by
      // construction and the spark always loads here. (The legacy tree keeps
      // its own compile-flag gate.)
      const today = format(new Date(), 'yyyy-MM-dd');
      const existing = getSparkByDate(userId, today);
      if (existing) {
        setTodaySpark(existing);
      } else {
        const recentTitles = listRecentSparkTitles(userId, 14);
        const sparkInterests = interests.map((i) => ({ name: i.name, category: i.category }));
        setSparkPending(true);
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), SPARK_TIMEOUT_MS);
        });
        // §3.2 fallback chain step 2: race generation against the timeout —
        // on timeout or rejection the hero slot re-resolves down the chain
        // (Frontier → EmptyState → empty wrapper). No skeleton-forever states.
        Promise.race([
          generateDailySpark({ interests: sparkInterests, recentSparkTitles: recentTitles }),
          timeout,
        ])
          .then((gen) => {
            if (!gen) return; // timed out — leave the slot to the chain
            const spark: Spark = { ...gen, id: nanoid(), userId, date: today, status: 'new', threadId: null, createdAt: new Date().toISOString() };
            recordSpark(spark);
            setTodaySpark(spark);
            track(EVENTS.sparkShown, { seedInterest: gen.seedInterest });
          })
          .catch(() => {}) // non-fatal — the chain takes over
          .finally(() => {
            if (timer) clearTimeout(timer);
            setSparkPending(false);
          });
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

  const buildFrontierSignal = useCallback((): FrontierSignal => {
    const today = new Date();
    const recentById = new Map<string, number>();
    log
      .filter((e) => differenceInCalendarDays(today, parseISO(e.date)) <= 14)
      .forEach((e) => recentById.set(e.interestId, (recentById.get(e.interestId) ?? 0) + e.minutesSpent));
    return {
      interests: interests.map((i) => ({
        name: i.name,
        category: i.category,
        explorationDepth: i.explorationDepth,
        recentMinutes: recentById.get(i.id) ?? 0,
      })),
    };
  }, [interests, log]);

  // One generation path for the initial load AND the frontier controls
  // (shuffle / regenerate / endpoint picks). `keepOnNull` is set on
  // user-initiated refreshes so an honest "no edge" (or a failure) keeps the
  // current card instead of yanking it out from under the user's finger.
  const runFrontier = useCallback(
    async (constraints?: FrontierConstraints, keepOnNull = false) => {
      setFrontierBusy(true);
      try {
        const f = await generateFrontier(buildFrontierSignal(), constraints);
        if (f) {
          // Dedupe: regenerate keeps returning the pinned pair — don't let it
          // pile duplicates into the shuffle-exclusion list.
          const bName = f.interestB;
          if (
            bName !== null &&
            !seenFrontierPairs.current.some(
              ([a, b]) => frontierPairKey(a, b) === frontierPairKey(f.interestA, bName),
            )
          ) {
            seenFrontierPairs.current.push([f.interestA, bName]);
          }
          track(EVENTS.frontierShown, { a: f.interestA, b: f.interestB ?? '' });
          setFrontier(f);
        } else if (!keepOnNull) {
          setFrontier(null);
        }
      } catch {
        if (!keepOnNull) setFrontier(null);
      } finally {
        setFrontierBusy(false);
      }
    },
    [buildFrontierSignal],
  );

  // Generate "The frontier" once interests are loaded — the single most fertile
  // unexplored edge between two interests the user already has. Needs at least
  // two interests; a null result (no honest edge) is valid.
  useEffect(() => {
    if (!userId || !frontierEnabled) return;
    if (frontier !== null) return;
    // An interests/log change while the first generation is still in flight
    // must not start a second, racing generation.
    if (frontierBusy) return;
    if (interests.length < 2) return;
    runFrontier();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, frontierEnabled, interests.length, log.length]);

  // ─── Frontier controls ──────────────────────────────────────────────────
  const handleFrontierShuffle = useCallback(() => {
    track(EVENTS.frontierShuffled, {});
    runFrontier({ excludePairs: [...seenFrontierPairs.current] }, true);
  }, [runFrontier]);

  const handleFrontierRegenerate = useCallback(() => {
    if (!frontier) return;
    track(EVENTS.frontierRegenerated, { a: frontier.interestA, b: frontier.interestB ?? '' });
    runFrontier(
      { pinA: frontier.interestA, pinB: frontier.interestB, avoidHeadline: frontier.headline },
      true,
    );
  }, [frontier, runFrontier]);

  const handleFrontierPickEndpoint = useCallback(
    (slot: 'a' | 'b', name: string | null) => {
      if (!frontier) return;
      // The picker only emits null for slot 'b' (solo mode); guard anyway.
      const pinA = slot === 'a' && name !== null ? name : frontier.interestA;
      const pinB = slot === 'b' ? name : frontier.interestB;
      track(EVENTS.frontierCustomized, { a: pinA, b: pinB ?? '' });
      runFrontier({ pinA, pinB }, true);
    },
    [frontier, runFrontier],
  );

  const totals = useMemo(() => weeklyMinutes(), [weeklyMinutes, interests]);
  const totalMinutesWeek = useMemo(
    () => Object.values(totals).reduce((a, b) => a + b, 0),
    [totals],
  );

  // Group saved maps by the interest they were seeded from: same-interest maps
  // cluster together (alphabetical), interest-tagged before free/spark maps,
  // newest-first within each group. Each card also shows its seed interest.
  const sortedTrees = useMemo(() => {
    const seedOf = (row: RabbitHoleTreeRow): string => {
      try { return (JSON.parse(row.anchorJson) as { seedInterest?: string | null }).seedInterest ?? ''; }
      catch { return ''; }
    };
    return [...rabbitHoleTrees].sort((a, b) => {
      const sa = seedOf(a), sb = seedOf(b);
      if (!!sa !== !!sb) return sa ? -1 : 1;             // interest-tagged first
      if (sa && sb && sa !== sb) return sa.localeCompare(sb); // then by interest
      return b.createdAt.localeCompare(a.createdAt);      // newest within a group
    });
  }, [rabbitHoleTrees]);

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

  // ─── Plan-from-interest (Dive → a structured expedition) ────────────────────
  const handlePlanFromInterest = useCallback(async (interest: { id: string; name: string }) => {
    if (!userId) return;
    const active = listActiveExpeditionProgress(userId);
    if (!canStartExpedition(active.length)) {
      // Cap reached — the sheet disables this, but guard anyway.
      track(EVENTS.expeditionStarted, { fromInterest: true, blockedByCap: true, capacity: MAX_ACTIVE_EXPEDITIONS });
      return;
    }
    try {
      const gen = await generateExpedition({ seedInterest: interest.name, theme: interest.name });
      const expeditionId = nanoid();
      createExpedition({
        id: expeditionId,
        userId,
        title: gen.title,
        theme: gen.theme,
        domain: 'polymath',
        steps: gen.steps,
        totalSteps: gen.steps.length,
        source: 'interest',
        seedSparkId: null,
        createdAt: new Date().toISOString(),
      });
      const progress = startExpedition(expeditionId, userId, {
        now: () => new Date().toISOString(),
        newId: () => nanoid(),
      });
      saveExpeditionProgress(progress);
      triggerStreak(userId, 'learning');
      track(EVENTS.expeditionStarted, { fromInterest: true });
      track(EVENTS.curiosityStreakDay, {});
      router.push({ pathname: '/expedition-detail', params: { id: expeditionId } });
    } catch {
      // Generation failed → no-op; the user can retry from the sheet.
    }
  }, [userId, router, triggerStreak]);

  // ─── Spark actions ─────────────────────────────────────────────────────────
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

  const handleExploreFrontier = useCallback((f: Frontier) => {
    if (!userId) return;
    track(EVENTS.frontierExplored, { a: f.interestA, b: f.interestB ?? '' });
    triggerStreak(userId, 'learning');
    track(EVENTS.curiosityStreakDay, {});
    router.push({
      pathname: '/rabbit-hole',
      params: {
        seedTitle: f.headline,
        seedBody: f.insight,
        seedInterest: f.interestA,
        // Solo frontier: no adjacent field — the rabbit hole stays inside one interest.
        ...(f.interestB !== null ? { seedAdjacent: f.interestB } : {}),
      },
    });
  }, [userId, router, triggerStreak]);

  // Interest names for the frontier endpoint picker.
  const frontierInterestNames = useMemo(() => interests.map((i) => i.name), [interests]);

  // The controls prop bundle, shared by the hero and demoted render slots.
  // Undefined handlers (flag off) render the original static card.
  const frontierControlProps = frontierControls
    ? {
        busy: frontierBusy,
        interestNames: frontierInterestNames,
        onShuffle: handleFrontierShuffle,
        onRegenerate: handleFrontierRegenerate,
        onPickEndpoint: handleFrontierPickEndpoint,
      }
    : {};

  // ─── Render ────────────────────────────────────────────────────────────────

  // §3.2: when the FrontierCard occupies the hero slot via the fallback chain
  // it does not render twice in the supporting cast.
  const frontierIsHero =
    todaySpark == null && !sparkPending && frontierEnabled && frontier != null;
  const showConstellation =
    constellationInputNodeCount(constellationInput) >= CONSTELLATION_MIN_NODES;
  const pairLabel = pair ? `${pair[0].name} × ${pair[1].name}` : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <InkCanvas />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* R1 block — full-bleed, outside the padded inner container. */}
          <ModuleHeader title="Explore" domain="polymath" color={c.polymath} />
          <View style={styles.contentInner}>

          {/* THE hero slot — ALWAYS mounted (§3.2/AC1), resolving the chain:
              spark → skeleton (raced) → frontier → empty state → empty wrapper. */}
          <View testID="explore-hero">
            {todaySpark ? (
              <Animated.View entering={FadeInDown.duration(scaled(MOTION_BUDGET.hero))}>
                <SparkHeroCard spark={todaySpark} onAction={handleSparkAction} />
              </Animated.View>
            ) : sparkPending ? (
              <Skeleton height={96} />
            ) : frontierIsHero && frontier ? (
              <Animated.View entering={FadeInDown.duration(scaled(MOTION_BUDGET.hero))}>
                <FrontierCard
                  frontier={frontier}
                  onExplore={handleExploreFrontier}
                  {...frontierControlProps}
                />
              </Animated.View>
            ) : interests.length === 0 ? (
              <Animated.View entering={FadeInDown.duration(scaled(MOTION_BUDGET.hero))}>
                <EmptyState
                  icon="compass-outline"
                  title="Follow one spark."
                  caption="Add an interest — a skill, a hobby, a question — and Explore maps where your curiosity goes."
                  accent={c.polymath}
                  cta={{ label: 'Add an interest', onPress: () => setShowAdd(true) }}
                />
              </Animated.View>
            ) : null}
          </View>

          {/* ─── Expeditions (§3.2 item 2) ─── */}
          {expeditionData.length > 0 && (
            <Animated.View
              entering={FadeIn.delay(stagger(0, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
            >
              <SectionTitle>Expeditions</SectionTitle>
              <ExpeditionProgressRow
                expeditions={expeditionData}
                onPress={(expId) => router.push({ pathname: '/expedition-detail', params: { id: expId } })}
              />
            </Animated.View>
          )}

          {/* ─── Chasing now (§3.2 item 3) ─── */}
          {exploreChasing && chasingThreads && chasingThreads.length > 0 && (
            <Animated.View
              entering={FadeIn.delay(stagger(1, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
            >
              <SectionTitle>Chasing now</SectionTitle>
              <ChasingNowCard threads={chasingThreads} onPull={handlePullThread} />
            </Animated.View>
          )}

          {/* ─── Week stat LINE — renders nothing at zero (§3.2 item 4 / AC8) ─── */}
          <WeekStatLine totalMinutesWeek={totalMinutesWeek} interestCount={interests.length} />

          {/* ─── Frontier / cross-discipline, demoted below the stat line (§3.2 item 5) ─── */}
          {!frontierIsHero && frontierEnabled && frontier ? (
            <Animated.View
              entering={FadeIn.delay(stagger(2, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
            >
              <FrontierCard
                frontier={frontier}
                onExplore={handleExploreFrontier}
                {...frontierControlProps}
              />
            </Animated.View>
          ) : pair ? (
            <Animated.View
              entering={FadeIn.delay(stagger(2, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
            >
              <CrossDisciplineCard
                link={cross?.link ?? null}
                loading={crossLoading}
                pairLabel={pairLabel}
                onRefresh={fetchCross}
              />
            </Animated.View>
          ) : null}

          {/* ─── Constellation — earns its slot at ≥3 nodes (§3.2 item 6) ─── */}
          {showConstellation && (
            <Animated.View
              entering={FadeIn.delay(stagger(3, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
            >
              <SectionTitle>Constellation</SectionTitle>
              <ConstellationView input={constellationInput} />
            </Animated.View>
          )}

          {/* ─── Your maps (§3.2 item 7) ─── */}
          {rabbitHoleTrees.length > 0 && (
            <Animated.View
              entering={FadeIn.delay(stagger(4, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
            >
              <SectionTitle>Your maps</SectionTitle>
              {sortedTrees.map((row) => {
                let mapTitle = row.title ?? '';
                let nodeCount = 0;
                let seedInterest = '';
                try {
                  const anchor = JSON.parse(row.anchorJson) as { title?: string; seedInterest?: string | null };
                  if (!mapTitle) mapTitle = anchor.title ?? '';
                  seedInterest = anchor.seedInterest ?? '';
                  nodeCount = Object.keys((JSON.parse(row.treeJson) as { nodeMap?: Record<string, unknown> }).nodeMap ?? {}).length;
                } catch {}
                const isNamed = !!mapTitle;
                const isSuggesting = suggestingFor === row.id;
                return (
                  <Pressable
                    key={row.id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      router.push({ pathname: '/rabbit-hole', params: { treeId: row.id } });
                    }}
                  >
                    {/* Neutral card — the polymath-hued map silhouette is the R3 mark. */}
                    <Card style={styles.mapCard}>
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
                            {seedInterest ? `${seedInterest} · ` : ''}{nodeCount} node{nodeCount === 1 ? '' : 's'} · {row.createdAt.slice(0, 10)}
                          </Caption>
                          {!isNamed && (
                            <Pressable
                              onPress={() => { Haptics.selectionAsync().catch(() => {}); handleSuggestTitle(row); }}
                              hitSlop={8}
                              disabled={isSuggesting}
                            >
                              <Caption style={{ color: isSuggesting ? c.textMuted : c.polymathText, marginTop: 2 }}>
                                {isSuggesting ? 'Naming…' : 'Suggest name →'}
                              </Caption>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </Animated.View>
          )}

          {/* ─── Your interests (§3.2 item 8) ─── */}
          <Animated.View
            entering={FadeIn.delay(stagger(5, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
          >
            <SectionTitle
              trailing={
                <Pressable
                  onPress={() => setShowAdd(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Add an interest"
                  style={[styles.addBtn, { backgroundColor: c.polymathDim }]}
                >
                  <Ionicons name="add" size={18} color={c.polymathText} />
                  <Body style={[styles.addBtnText, { color: c.polymathText }]}>Add</Body>
                </Pressable>
              }
            >
              Your interests
            </SectionTitle>
            {pickToExplore && (
              <Pressable
                onPress={() => setFreeExplore(true)}
                style={[styles.freeExploreBtn, { borderColor: c.border }]}
                accessibilityRole="button"
                accessibilityLabel="Explore any idea"
              >
                <Ionicons name="search" size={16} color={c.polymathText} />
                <Body style={{ color: c.polymathText }}>Explore any idea…</Body>
              </Pressable>
            )}
            {interests.map((interest) => (
              <InterestCard
                key={interest.id}
                interest={interest}
                weeklyActual={totals[interest.id] ?? 0}
                onLog={() => setActiveInterest(interest)}
                onDelete={() => handleDelete(interest.id)}
                onEditDepth={() => setDepthFor(interest)}
                onToggleProtect={() => handleToggleProtect(interest)}
                onExplore={pickToExplore ? () => setExploreFor(interest) : undefined}
              />
            ))}
          </Animated.View>

          {/* ─── Connections — always the LAST section; web-only row (§3.2 item 9) ─── */}
          {Platform.OS === 'web' && userId && (
            <View>
              <SectionTitle>Connections</SectionTitle>
              <YouTubeImportCard
                presentation="row"
                existingInterestNames={interests.map((i) => i.name)}
                onImport={handleYouTubeImport}
              />
            </View>
          )}
          </View>
        </ScrollView>

        <AddInterestSheet
          visible={showAdd}
          onClose={handleCloseAdd}
          onAdd={handleAdd}
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
        <ExploreActionSheet
          visible={!!exploreFor}
          interest={exploreFor}
          otherInterests={interests.filter(
            (i) => i.id !== exploreFor?.id && (i.status === 'active' || i.status === 'exploring'),
          )}
          onDive={launcher.dive}
          onBridge={launcher.bridge}
          onPlan={handlePlanFromInterest}
          canPlan={expeditionData.length < MAX_ACTIVE_EXPEDITIONS}
          onClose={() => setExploreFor(null)}
        />
        <FreeExploreSheet
          visible={freeExplore}
          onExplore={launcher.freeDive}
          onClose={() => setFreeExplore(false)}
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
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  contentInner: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  addBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
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
  freeExploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.control,
    borderWidth: 1,
  },
});
