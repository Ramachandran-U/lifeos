import { useState, useCallback, useMemo, useRef, useEffect, type ReactElement } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { Body, Caption } from '@/components/ui/Typography';
import { EmptyState } from '@/components/ui/EmptyState';
import { InkCanvas } from '@/components/shared/InkCanvas';
import { GoalCard } from '@/components/modules/goals/GoalCard';
import { AddGoalSheet } from '@/components/modules/goals/AddGoalSheet';
import { TrajectoryCard } from '@/components/modules/goals/TrajectoryCard';
import { GoalDetailSheet } from '@/components/modules/goals/GoalDetailSheet';
import { MotivationBanner } from '@/components/shared/MotivationBanner';
import { format } from 'date-fns';
import { useUserStore } from '@/store/useUserStore';
import { useGoalStore } from '@/store/useGoalStore';
import { useGameStore } from '@/store/useGameStore';
import { useSyncStore } from '@/store/useSyncStore';
import { useFlagStore } from '@/store/useFlagStore';
import { updateGoalStatus, getDeletedGoals, restoreGoal } from '@/db/queries/goals';
import { getCommentCountsByUser } from '@/db/queries/goalComments';
import { GOAL_TYPE_LEGEND, useGoalTypeColor } from '@/utils/goalTypeColor';
import { useScreenTracking } from '@/hooks/useScreenTracking';
import { track, EVENTS } from '@/utils/telemetry';
import { haptic } from '@/utils/haptics';
import { isEnabled } from '@/config/flags';
import { getRoutineBlocksByDate, createRoutineBlocks } from '@/db/queries/routine';
import { getUserProfile } from '@/db/queries/userProfile';
import { replanRemainingDay } from '@/ai/functions';
import { applyReplan } from '@/ai/replanApply';
import { stashReplan, readStash, clearStash, browserStashStorage } from '@/cognition/replanStash';
import { GoalReplanSheet, type GoalReplanPhase } from '@/components/shared/GoalReplanSheet';
import { GoalRebalanceSheet, type GoalRebalancePhase, type RebalanceSuggestion } from '@/components/shared/GoalRebalanceSheet';
import { rebalanceGoals, detectDomainDivergence } from '@/ai/goalRebalance';
import { updateGoalMetadata } from '@/db/queries/goals';
import { computeLastWeekDomainMinutes } from '@/utils/routineBalance';
import type { ReplanRemainingDay } from '@/ai/types';
import type { ExistingBlock } from '@/components/shared/RoutineDiffPreview';

type GoalLike = ReturnType<typeof import('@/db/queries/goals').getGoalsByUser>[number];

export default function GoalsScreen() {
  const c = useColors();
  useScreenTracking('goals');
  const getTypeColor = useGoalTypeColor();
  const { userId, primaryDomains } = useUserStore();
  const { goals, loadGoals, removeGoal, snoozeGoal, resumeGoal, reactivateDue } = useGoalStore();
  const completeGoalNode = useGameStore((s) => s.completeGoalNode);
  // W3 answer-first: the same flag that mounts NextMoveHero on Today hides
  // this tab's inline card — the card moves, it does not fork (§3.2). The
  // JSX + styles are deleted outright at fallback-flip.
  const answerFirst = useFlagStore((s) => s.isEnabled('today_answer_first_v1'));
  // Re-read when the sync engine applies a remote pull (P1 Increment 3), so a
  // goal synced from another device repaints without a manual reload.
  const syncTick = useSyncStore((s) => s.appliedTick);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [detailGoalId, setDetailGoalId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [deletedGoals, setDeletedGoals] = useState<GoalLike[]>([]);
  // Re-plan-after-goal-change flow (mirrors the priority-change adjust-now path).
  const [replan, setReplan] = useState<{
    visible: boolean; phase: GoalReplanPhase; goalTitle: string;
    action: 'removed' | 'postponed' | 'added'; plan: ReplanRemainingDay | null; existing: ExistingBlock[];
  }>({ visible: false, phase: 'choice', goalTitle: '', action: 'removed', plan: null, existing: [] });

  // Domain-divergence rebalance flow — one nudge per session at most.
  const divergenceNudgedThisSession = useRef(false);
  const [rebalance, setRebalance] = useState<{
    visible: boolean; phase: GoalRebalancePhase;
    starvedDomain: string; suggestions: RebalanceSuggestion[]; insight: string;
  }>({ visible: false, phase: 'choice', starvedDomain: '', suggestions: [], insight: '' });

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        // Auto-resume any goals whose postpone date has passed, then load.
        reactivateDue(userId, format(new Date(), 'yyyy-MM-dd'));
        loadGoals(userId);
        setDeletedGoals(getDeletedGoals(userId));

        // Proactive domain-divergence check (once per session).
        if (!divergenceNudgedThisSession.current) {
          const weekMinutes = computeLastWeekDomainMinutes();
          const candidate = detectDomainDivergence({
            primaryDomains,
            actualMinutesByDomain: weekMinutes,
            cooldownOk: () => true,
          });
          if (candidate) {
            divergenceNudgedThisSession.current = true;
            setRebalance({ visible: true, phase: 'choice', starvedDomain: candidate.domain, suggestions: [], insight: '' });
          }
        }
      }
    }, [userId, loadGoals, reactivateDue, syncTick, primaryDomains])
  );

  // Postponed (paused) goals are hidden from the active tree and surfaced in
  // their own collapsible section with a Resume action.
  const mainGoals = useMemo(
    () => goals.filter((g) => !g.parentId && g.level !== 'daily' && g.status !== 'paused'),
    [goals],
  );

  const childrenByParent = useMemo(() => {
    const map: Record<string, GoalLike[]> = {};
    for (const g of goals) {
      if (!g.parentId || g.status === 'paused') continue;
      (map[g.parentId] = map[g.parentId] ?? []).push(g);
    }
    return map;
  }, [goals]);

  const dailyTasks = goals.filter((g) => g.level === 'daily' && g.status === 'active');

  const postponedGoals = useMemo(
    () => goals.filter((g) => g.status === 'paused'),
    [goals],
  );

  /** Read the YYYY-MM-DD a paused goal is snoozed until from its metadata JSON. */
  const snoozeUntilOf = (g: GoalLike): string | null => {
    if (typeof g.metadata !== 'string' || !g.metadata) return null;
    try {
      const m: unknown = JSON.parse(g.metadata);
      const until = (m as { snoozeUntil?: unknown })?.snoozeUntil;
      return typeof until === 'string' ? until : null;
    } catch {
      return null;
    }
  };

  // #5: a flat "Achievements" log of everything completed, newest first, so
  // there's a place to see what's been accomplished (the tree mixes done +
  // active nodes and buries completed ones).
  const completedGoals = useMemo(
    () =>
      goals
        .filter((g) => g.status === 'completed')
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [goals],
  );
  const [showArchive, setShowArchive] = useState(false);
  const [completionToast, setCompletionToast] = useState<{ title: string; id: string } | null>(null);

  useEffect(() => {
    if (!completionToast) return;
    const t = setTimeout(() => setCompletionToast(null), 4000);
    return () => clearTimeout(t);
  }, [completionToast]);

  // completedGoals kept for archive section

  // Now = strategic horizon (life/yearly); Build = execution layer (monthly/weekly).
  const nowGoals = useMemo(
    () => mainGoals.filter((g) => g.level === 'life' || g.level === 'yearly'),
    [mainGoals],
  );
  const buildGoals = useMemo(
    () => mainGoals.filter((g) => g.level !== 'life' && g.level !== 'yearly'),
    [mainGoals],
  );

  // P4-04: the 3-year vision is the root `life` goal. Show its on-track
  // trajectory above the tree once it has at least one sub-goal.
  const lifeGoal = useMemo(() => goals.find((g) => g.level === 'life' && !g.parentId), [goals]);

  // One batch read instead of one per goal per render (§11.3).
  const commentCounts = useMemo(
    () => (userId ? getCommentCountsByUser(userId) : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, version],
  );

  // Memoised descendant counts — computed once per goals change, O(n) total
  // instead of O(n²) from per-node subtree walks on every render (§11.3).
  const descendantCounts = useMemo(() => {
    const map: Record<string, { total: number; completed: number }> = {};
    const compute = (id: string): { total: number; completed: number } => {
      if (map[id]) return map[id];
      const children = childrenByParent[id] ?? [];
      let total = 0, completed = 0;
      for (const child of children) {
        total++;
        if (child.status === 'completed') completed++;
        const sub = compute(child.id);
        total += sub.total;
        completed += sub.completed;
      }
      return (map[id] = { total, completed });
    };
    for (const g of goals) compute(g.id);
    return map;
  }, [goals, childrenByParent]);

  const progressFor = (id: string): number => {
    const { total, completed } = descendantCounts[id] ?? { total: 0, completed: 0 };
    if (total === 0) return 0;
    return (completed / total) * 100;
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCompleteTask = (id: string) => {
    const goal = goals.find((g) => g.id === id);
    if (goal?.status === 'completed') return; // don't double-score a re-tap
    updateGoalStatus(id, 'completed');
    if (goal && userId) completeGoalNode(userId, goal.goalType, goal.level);
    if (goal) track(EVENTS.goalCompleted, { goal_id: goal.id, goal_type: goal.goalType, level: goal.level });
    if (goal) setCompletionToast({ title: goal.title, id: goal.id });
    if (userId) loadGoals(userId);
  };

  const handleUndoComplete = (id: string) => {
    updateGoalStatus(id, 'active');
    setCompletionToast(null);
    if (userId) loadGoals(userId);
  };

  const openGoalDetail = (goal: GoalLike) => {
    track(EVENTS.goalDetailOpened, { goal_id: goal.id, goal_type: goal.goalType, level: goal.level });
    setDetailGoalId(goal.id);
  };

  const handleRestore = (id: string) => {
    restoreGoal(id);
    track(EVENTS.goalRestored, { goal_id: id });
    if (userId) {
      loadGoals(userId);
      setDeletedGoals(getDeletedGoals(userId));
    }
  };

  const detailGoal = detailGoalId ? goals.find((g) => g.id === detailGoalId) : null;

  const todayStr = () => format(new Date(), 'yyyy-MM-dd');
  const nowHHMM = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const handleRebalanceCheckNow = async () => {
    setRebalance((r) => ({ ...r, phase: 'loading' }));
    try {
      const active = goals.filter((g) => g.status === 'active' && g.level !== 'daily' && !g.parentId);
      const totalHours = 40;
      const defaultHours = active.length > 0
        ? Math.round((totalHours / active.length) * 10) / 10
        : 5;
      const input = {
        goals: active.map((g) => {
          let weeklyHoursAllocated = defaultHours;
          if (typeof g.metadata === 'string' && g.metadata) {
            try {
              const m = JSON.parse(g.metadata) as Record<string, unknown>;
              if (typeof m.weeklyHoursTarget === 'number') weeklyHoursAllocated = m.weeklyHoursTarget;
            } catch { /* keep default */ }
          }
          return { id: g.id, title: g.title, type: g.goalType, currentProgress: progressFor(g.id) / 100, weeklyHoursAllocated };
        }),
        totalAvailableHours: totalHours,
      };
      const proposal = await rebalanceGoals(input);
      if (!proposal) { setRebalance((r) => ({ ...r, phase: 'error' })); return; }
      const suggestions: RebalanceSuggestion[] = proposal.suggestions.map((s) => {
        const g = goals.find((g) => g.id === s.goalId);
        return { goalId: s.goalId, goalTitle: g?.title ?? s.goalId, weeklyHours: s.weeklyHours, reason: s.reason };
      });
      setRebalance((r) => ({ ...r, phase: 'preview', suggestions, insight: proposal.insight }));
    } catch {
      setRebalance((r) => ({ ...r, phase: 'error' }));
    }
  };

  const handleConfirmRebalance = () => {
    for (const s of rebalance.suggestions) {
      updateGoalMetadata(s.goalId, { weeklyHoursTarget: s.weeklyHours });
    }
    setRebalance((r) => ({ ...r, phase: 'applied' }));
  };

  const closeRebalance = () => setRebalance((r) => ({ ...r, visible: false }));

  /**
   * After a goal is removed/postponed, offer to rebalance the rest of today.
   * Only when the priorityAdjust flag is on AND there are still blocks left
   * today — otherwise there's nothing to adjust, so stay silent.
   */
  const offerReplan = (goalTitle: string, action: 'removed' | 'postponed' | 'added') => {
    if (!isEnabled('priorityAdjust')) return;
    const now = nowHHMM();
    const remaining = getRoutineBlocksByDate(todayStr()).filter((b) => b.startTime >= now);
    if (remaining.length === 0) return;
    setReplan({ visible: true, phase: 'choice', goalTitle, action, plan: null, existing: [] });
  };

  /** After a goal is created, offer to work it into the rest of today (gated). */
  const handleGoalCreated = (title: string) => offerReplan(title, 'added');

  const handleGoalRemove = () => {
    if (!detailGoal || !userId) return;
    const title = detailGoal.title;
    // M0 haptic gap-fill: destructive action → warning, not success.
    if (isEnabled('motionPolish')) haptic.warning();
    removeGoal(detailGoal.id, userId);
    track(EVENTS.goalRemoved, { goal_id: detailGoal.id, level: detailGoal.level });
    setDeletedGoals(getDeletedGoals(userId));
    setDetailGoalId(null);
    offerReplan(title, 'removed');
  };

  const handleGoalPostpone = (untilDate: string) => {
    if (!detailGoal || !userId) return;
    const title = detailGoal.title;
    snoozeGoal(detailGoal.id, untilDate, userId);
    track(EVENTS.goalPostponed, { goal_id: detailGoal.id, level: detailGoal.level, until: untilDate });
    setDetailGoalId(null);
    offerReplan(title, 'postponed');
  };

  const handleGoalResume = (id: string) => {
    if (!userId) return;
    resumeGoal(id, userId);
    track(EVENTS.goalResumed, { goal_id: id });
    setDetailGoalId(null);
  };

  const handleAdjustNow = async () => {
    if (!userId) return;
    setReplan((r) => ({ ...r, phase: 'loading' }));
    try {
      const profile = await getUserProfile(userId);
      const now = nowHHMM();
      const today = todayStr();
      const allBlocks = getRoutineBlocksByDate(today);
      const remaining = allBlocks
        .filter((b) => b.startTime >= now)
        .map((b) => ({
          id: b.id, startTime: b.startTime, endTime: b.endTime, title: b.title, module: b.module,
          status: b.status as 'upcoming' | 'in_progress' | 'completed' | 'skipped',
        }));
      const skippedToday = allBlocks
        .filter((b) => b.status === 'skipped')
        .map((b) => ({ id: b.id, title: b.title, module: b.module }));
      const existing: ExistingBlock[] = remaining.map((b) => ({
        id: b.id, startTime: b.startTime, endTime: b.endTime, title: b.title, module: b.module,
      }));
      const plan = await replanRemainingDay({
        nowHHMM: now,
        remainingBlocks: remaining,
        skippedToday,
        primaryDomains,
        chronotype: profile?.chronotype ?? null,
        ...(replan.action === 'added'
          ? { addedGoals: [replan.goalTitle] }
          : { droppedGoals: [replan.goalTitle] }),
      });
      setReplan((r) => ({ ...r, phase: 'preview', plan, existing }));
    } catch {
      setReplan((r) => ({ ...r, phase: 'error' }));
    }
  };

  const handleConfirmPreview = () => {
    if (!replan.plan || !userId) return;
    const today = todayStr();
    const plan = replan.plan;
    const allBlocks = getRoutineBlocksByDate(today);
    const droppedBlocks = allBlocks
      .filter((b) => plan.drop.includes(b.id))
      .map((b) => ({
        id: b.id, date: b.date, startTime: b.startTime, endTime: b.endTime,
        title: b.title, module: b.module, status: b.status,
        linkedEntityId: b.linkedEntityId ?? null, energyRequired: b.energyRequired ?? null,
      }));
    const beforeIds = new Set(allBlocks.map((b) => b.id));
    applyReplan(plan, today);
    const insertedBlockIds = getRoutineBlocksByDate(today).map((b) => b.id).filter((id) => !beforeIds.has(id));
    stashReplan(browserStashStorage(), userId, today, {
      droppedBlocks, insertedBlockIds, priorPriorities: primaryDomains,
    });
    setReplan((r) => ({ ...r, phase: 'applied' }));
  };

  const handleReplanUndo = () => {
    if (!userId) { setReplan((r) => ({ ...r, visible: false })); return; }
    const storage = browserStashStorage();
    const today = todayStr();
    const entry = readStash(storage, userId, today);
    if (!entry) { setReplan((r) => ({ ...r, visible: false })); return; }
    const allBlocks = getRoutineBlocksByDate(today);
    const insertedSet = new Set(entry.insertedBlockIds);
    const toDelete = allBlocks.filter((b) => insertedSet.has(b.id)).map((b) => b.id);
    applyReplan({ drop: toDelete, edits: [], add: [], rationale: 'undo' }, today);
    if (entry.droppedBlocks.length > 0) {
      createRoutineBlocks(entry.droppedBlocks.map((b) => ({
        date: b.date, startTime: b.startTime, endTime: b.endTime,
        title: b.title, module: b.module, energyRequired: b.energyRequired ?? undefined,
      })));
    }
    clearStash(storage, userId, today);
    setReplan((r) => ({ ...r, visible: false }));
  };

  const closeReplan = () => setReplan((r) => ({ ...r, visible: false }));

  const styles = makeStyles(c);

  const renderGoalNode = (goal: GoalLike, depth: number): ReactElement => {
    const children = childrenByParent[goal.id] ?? [];
    const isExpanded = expandedIds.has(goal.id);
    const hasChildren = children.length > 0;
    const tc = getTypeColor(goal.goalType);

    return (
      // Nesting guide is structure, not domain color — neutral hairline.
      <View key={goal.id} style={[styles.nodeWrap, depth > 0 && { marginLeft: spacing.md, borderLeftColor: c.border, borderLeftWidth: 2, paddingLeft: spacing.md }]}>
        <View style={styles.nodeRow}>
          <View style={{ flex: 1 }}>
            <GoalCard
              title={goal.title}
              level={goal.level}
              status={goal.status}
              progress={progressFor(goal.id)}
              goalType={goal.goalType}
              commentCount={commentCounts[goal.id] ?? 0}
              onPress={() => openGoalDetail(goal)}
              isPrimary={depth === 0 && goal.level === 'life'}
              stepCount={(descendantCounts[goal.id] ?? { total: 0, completed: 0 }).total}
              stepsComplete={(descendantCounts[goal.id] ?? { total: 0, completed: 0 }).completed}
            />
          </View>
          {hasChildren && (
            <Pressable
              onPress={() => toggleExpand(goal.id)}
              style={[styles.chevronBtn, { backgroundColor: tc.dim, borderColor: c.border }]}
              hitSlop={8}
            >
              <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={tc.text} />
              <Caption style={{ color: tc.text, fontFamily: fonts.heading }}>{children.length}</Caption>
            </Pressable>
          )}
        </View>

        {depth === 0 && isExpanded && (
          <MotivationBanner module="goals" context={goal.title} accent={tc.hue} />
        )}

        {isExpanded && hasChildren && (
          <View style={styles.childrenWrap}>
            {children.map((child) => renderGoalNode(child, depth + 1))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <InkCanvas />
      <SafeAreaView style={styles.container}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        {/* R1 block — full-bleed, outside the padded inner container. */}
        <ModuleHeader title="Goals" domain="goal" color={c.goal} />
        <View style={styles.scrollInner}>

        <View style={styles.legendRow}>
          {GOAL_TYPE_LEGEND.map((entry) => {
            const tc = getTypeColor(entry.goalType);
            return (
              <View key={entry.goalType} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: tc.hue }]} />
                <Caption style={{ color: c.textSecondary }}>{entry.label}</Caption>
              </View>
            );
          })}
          <Pressable
            onPress={() => setRebalance({ visible: true, phase: 'choice', starvedDomain: '', suggestions: [], insight: '' })}
            style={[styles.rebalanceChip, { borderColor: c.border }]}
          >
            <Ionicons name="git-branch-outline" size={12} color={c.goalText} />
            <Caption style={{ color: c.goalText, fontFamily: fonts.heading }}>Balance</Caption>
          </Pressable>
        </View>

        {/* Life vision — only show once there are sub-goals to track */}
        {lifeGoal && (childrenByParent[lifeGoal.id] ?? []).length > 0 && (
          <TrajectoryCard lifeGoal={lifeGoal} goals={goals} />
        )}

        {/* YOUR NEXT MOVE — first active daily task. Renders only while
            today_answer_first_v1 is off: flag-on, Today's NextMoveHero is the
            single answer surface. */}
        {!answerFirst && dailyTasks.length > 0 && (
          <View style={[styles.nextMoveCard, { backgroundColor: c.goalDim, borderColor: c.border }]}>
            <View style={styles.nextMoveHeader}>
              <Ionicons name="flash" size={14} color={c.goalText} />
              <Caption style={{ color: c.goalText, fontFamily: fonts.heading, letterSpacing: 0.5 }}>YOUR NEXT MOVE</Caption>
            </View>
            <Body style={[styles.nextMoveTitle, { color: c.textPrimary }]} numberOfLines={2}>
              {dailyTasks[0].title}
            </Body>
            {dailyTasks.length > 1 && (
              <Caption style={{ color: c.textMuted }}>{`+${dailyTasks.length - 1} more task${dailyTasks.length > 2 ? 's' : ''} today`}</Caption>
            )}
            <View style={styles.nextMoveActions}>
              <Pressable
                onPress={() => handleCompleteTask(dailyTasks[0].id)}
                style={[styles.nextMoveBtn, { backgroundColor: c.goal }]}
              >
                <Ionicons name="checkmark" size={14} color={c.inkOnColor} />
                <Caption style={{ color: c.inkOnColor, fontFamily: fonts.heading }}>Mark done</Caption>
              </Pressable>
              <Pressable
                onPress={() => openGoalDetail(dailyTasks[0])}
                style={[styles.nextMoveBtn, { backgroundColor: 'transparent', borderColor: c.border, borderWidth: 1 }]}
              >
                <Caption style={{ color: c.goalText, fontFamily: fonts.heading }}>View</Caption>
              </Pressable>
            </View>
          </View>
        )}

        {/* NOW — strategic horizon (life / yearly goals) */}
        {nowGoals.length > 0 && (
          <View style={styles.section}>
            <Body style={styles.sectionTitle}>Now</Body>
            {nowGoals.map((g, i) => (
              <Animated.View key={g.id} entering={FadeInDown.delay(i * 60).duration(300)}>
                {renderGoalNode(g, 0)}
              </Animated.View>
            ))}
          </View>
        )}

        {/* BUILD — execution layer (monthly / weekly goals) */}
        {buildGoals.length > 0 && (
          <View style={styles.section}>
            <Body style={styles.sectionTitle}>Build</Body>
            {buildGoals.map((g, i) => (
              <Animated.View key={g.id} entering={FadeInDown.delay(i * 60).duration(300)}>
                {renderGoalNode(g, 0)}
              </Animated.View>
            ))}
          </View>
        )}

        {mainGoals.length === 0 && (
          <EmptyState
            icon="flag-outline"
            title="No goals yet"
            caption="Tap + to add your first goal"
            accent={c.goal}
          />
        )}

        {/* ARCHIVE — completed, postponed, deleted */}
        {(completedGoals.length > 0 || postponedGoals.length > 0 || deletedGoals.length > 0) && (
          <View style={styles.section}>
            <Pressable style={styles.achievementsHeader} onPress={() => setShowArchive((s) => !s)}>
              <Ionicons name="archive-outline" size={18} color={c.textMuted} />
              <Body style={[styles.sectionTitle, { flex: 1, marginBottom: 0 }]}>
                {`Archive · ${completedGoals.length + postponedGoals.length + deletedGoals.length}`}
              </Body>
              <Ionicons name={showArchive ? 'chevron-up' : 'chevron-down'} size={18} color={c.textMuted} />
            </Pressable>
            {showArchive && (
              <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                {completedGoals.map((g) => {
                  return (
                    <View key={g.id} style={[styles.achievementRow, { backgroundColor: c.surface }]}>
                      <Ionicons name="checkmark-circle" size={18} color={c.success} />
                      <View style={{ flex: 1 }}>
                        <Body style={{ color: c.textPrimary }} numberOfLines={2}>{g.title}</Body>
                        <Caption style={{ color: c.textMuted }}>
                          {`${g.level.charAt(0).toUpperCase()}${g.level.slice(1)} · done ${g.updatedAt.slice(0, 10)}`}
                        </Caption>
                      </View>
                    </View>
                  );
                })}
                {postponedGoals.map((g) => {
                  const until = snoozeUntilOf(g);
                  return (
                    <View key={g.id} style={[styles.achievementRow, { backgroundColor: c.surface }]}>
                      <Ionicons name="moon-outline" size={18} color={c.textMuted} />
                      <View style={{ flex: 1 }}>
                        <Body style={{ color: c.textPrimary }} numberOfLines={2}>{g.title}</Body>
                        <Caption style={{ color: c.textMuted }}>
                          {`Paused${until ? ` until ${until}` : ''}`}
                        </Caption>
                      </View>
                      <Pressable
                        onPress={() => handleGoalResume(g.id)}
                        style={[styles.restoreBtn, { borderColor: c.border }]}
                        hitSlop={8}
                      >
                        <Ionicons name="play" size={16} color={c.goalText} />
                        <Caption style={{ color: c.goalText, fontFamily: fonts.heading }}>Resume</Caption>
                      </Pressable>
                    </View>
                  );
                })}
                {deletedGoals.map((g) => {
                  return (
                    <View key={g.id} style={[styles.achievementRow, { backgroundColor: c.surface }]}>
                      <Ionicons name="trash-outline" size={18} color={c.textMuted} />
                      <View style={{ flex: 1 }}>
                        <Body style={{ color: c.textPrimary }} numberOfLines={2}>{g.title}</Body>
                        <Caption style={{ color: c.textMuted }}>
                          {`Deleted${g.deletedAt ? ` ${g.deletedAt.slice(0, 10)}` : ''}`}
                        </Caption>
                      </View>
                      <Pressable
                        onPress={() => handleRestore(g.id)}
                        style={[styles.restoreBtn, { borderColor: c.border }]}
                        hitSlop={8}
                      >
                        <Ionicons name="arrow-undo" size={16} color={c.goalText} />
                        <Caption style={{ color: c.goalText, fontFamily: fonts.heading }}>Restore</Caption>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
        </View>
      </ScrollView>

      {/* Completion toast with Undo */}
      {completionToast && (
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={[styles.completionToast, { backgroundColor: c.success, borderColor: c.success }]}
        >
          <Ionicons name="checkmark-circle" size={20} color={c.inkOnColor} />
          <Body style={{ color: c.inkOnColor, flex: 1, fontFamily: fonts.heading }} numberOfLines={1}>
            {completionToast.title}
          </Body>
          <Pressable
            onPress={() => handleUndoComplete(completionToast.id)}
            style={styles.undoBtn}
            hitSlop={8}
          >
            <Caption style={{ color: c.inkOnColor, fontFamily: fonts.heading }}>Undo</Caption>
          </Pressable>
          <Pressable onPress={() => setCompletionToast(null)} hitSlop={8}>
            <Ionicons name="close" size={16} color={c.inkOnColor} />
          </Pressable>
        </Animated.View>
      )}

      <Pressable testID="add-goal-fab" style={styles.fab} onPress={() => setShowAddSheet(true)}>
        <Ionicons name="add" size={28} color={c.inkOnColor} />
      </Pressable>

      <AddGoalSheet
        visible={showAddSheet}
        onClose={() => {
          setShowAddSheet(false);
          if (userId) loadGoals(userId);
        }}
        onGoalCreated={handleGoalCreated}
      />

      {detailGoal && userId && (
        <GoalDetailSheet
          visible={!!detailGoalId}
          onClose={() => setDetailGoalId(null)}
          goalId={detailGoal.id}
          goalTitle={detailGoal.title}
          goalType={detailGoal.goalType}
          goalLevel={detailGoal.level}
          initialDescription={detailGoal.description ?? ''}
          userId={userId}
          goalStatus={detailGoal.status}
          snoozeUntil={snoozeUntilOf(detailGoal)}
          goalUpdatedAt={detailGoal.updatedAt}
          onCommentChange={() => setVersion((v) => v + 1)}
          onDescriptionChange={() => {
            if (userId) loadGoals(userId);
            setVersion((v) => v + 1);
          }}
          onFieldsChanged={() => {
            if (userId) loadGoals(userId);
            setVersion((v) => v + 1);
          }}
          onRemove={handleGoalRemove}
          onPostpone={handleGoalPostpone}
          onResume={() => handleGoalResume(detailGoal.id)}
        />
      )}

      <GoalReplanSheet
        visible={replan.visible}
        phase={replan.phase}
        goalTitle={replan.goalTitle}
        action={replan.action}
        plan={replan.plan}
        existing={replan.existing}
        onAdjustNow={handleAdjustNow}
        onSkip={closeReplan}
        onConfirmPreview={handleConfirmPreview}
        onCancelPreview={() => setReplan((r) => ({ ...r, phase: 'choice', plan: null }))}
        onUndo={handleReplanUndo}
        onClose={closeReplan}
        onRetry={handleAdjustNow}
      />

      <GoalRebalanceSheet
        visible={rebalance.visible}
        phase={rebalance.phase}
        starvedDomain={rebalance.starvedDomain}
        suggestions={rebalance.suggestions}
        insight={rebalance.insight}
        onCheckNow={handleRebalanceCheckNow}
        onConfirm={handleConfirmRebalance}
        onDismiss={closeRebalance}
        onRetry={handleRebalanceCheckNow}
      />
      </SafeAreaView>
    </View>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    scroll: { paddingBottom: spacing.xxxl, gap: spacing.md },
    scrollInner: { paddingHorizontal: spacing.xl, gap: spacing.md },
    legendRow: {
      flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md,
      paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
      backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    rebalanceChip: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
      paddingVertical: 3, paddingHorizontal: spacing.sm,
      borderRadius: 999, borderWidth: 1, marginLeft: 'auto',
    },
    section: { gap: spacing.sm },
    sectionTitle: {
      fontFamily: fonts.heading, fontSize: fontSizes.lg, marginTop: spacing.sm, color: c.textPrimary,
    },
    achievementsHeader: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm,
    },
    achievementRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      padding: spacing.md, borderRadius: 12,
    },
    restoreBtn: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
      paddingVertical: spacing.xs, paddingHorizontal: spacing.sm,
      borderRadius: 10, borderWidth: 1,
    },
    nextMoveCard: {
      borderRadius: 16, borderWidth: 1, padding: spacing.md, gap: spacing.xs,
    },
    nextMoveHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    nextMoveTitle: { fontFamily: fonts.heading, fontSize: fontSizes.lg, lineHeight: fontSizes.lg * 1.3 },
    nextMoveActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
    nextMoveBtn: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
      paddingVertical: spacing.xs, paddingHorizontal: spacing.md,
      borderRadius: 10, minHeight: 36,
    },
    completionToast: {
      position: 'absolute', bottom: 110, left: spacing.xl, right: spacing.xl,
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      borderRadius: 16, borderWidth: 1, padding: spacing.md,
      elevation: 10, shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
    },
    undoBtn: {
      paddingVertical: spacing.xs, paddingHorizontal: spacing.sm,
      borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)',
    },
    nodeWrap: { gap: spacing.sm },
    nodeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    chevronBtn: {
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      width: 44, paddingVertical: spacing.xs, borderRadius: 12, borderWidth: 1,
    },
    childrenWrap: { gap: spacing.sm, marginTop: spacing.xs },
    taskRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
      backgroundColor: c.card, borderRadius: 12,
      borderWidth: 1, borderColor: c.border, borderLeftWidth: 4,
    },
    taskText: { flex: 1, color: c.textPrimary },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
    emptyText: { color: c.textMuted, fontSize: fontSizes.lg },
    fab: {
      position: 'absolute', bottom: 100, right: spacing.xl,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: c.goal, alignItems: 'center', justifyContent: 'center',
      elevation: 6, shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    },
  });
}
