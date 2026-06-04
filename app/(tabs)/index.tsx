import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { useStaggerDelay } from '@/theme/motion';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { useDensityScale } from '@/theme/density';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { Heading, Body, Label, Caption } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { GlassCard } from '@/components/ui/GlassCard';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Text as AuroraText } from '@/components/ui/Text';
import { RoutineBlock } from '@/components/shared/RoutineBlock';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { useAmbientEventStore } from '@/components/shared/ambient/useAmbientEventStore';
import { WeeklyBalanceCard } from '@/components/shared/WeeklyBalanceCard';
import { Confetti } from '@/components/shared/Confetti';
import { DailySummarySheet } from '@/components/shared/DailySummarySheet';
import { YesterdayLogSheet } from '@/components/shared/YesterdayLogSheet';
import { AdaptationCard } from '@/components/shared/AdaptationCard';
import { WhatNextCard } from '@/components/shared/WhatNextCard';
import { CoachActionsCard } from '@/components/shared/CoachActionsCard';
import { LifeScoreHero } from '@/components/shared/LifeScoreHero';
import { useBehaviourSuggestionsStore } from '@/store/useBehaviourSuggestionsStore';
import { getReflectionByDate } from '@/db/queries/reflections';
import { DailyBriefing } from '@/components/shared/DailyBriefing';
import { useDailyBriefing } from '@/hooks/useDailyBriefing';
import { getGoalsByUser } from '@/db/queries/goals';
import { getContactsByUser, computeOverdue } from '@/db/queries/social';
import { computeLifeScore, lifeScoreBand } from '@/utils/lifeScore';
import type { DailyBriefingInput } from '@/ai/types';
import { VoiceAssistantSheet } from '@/components/shared/VoiceAssistantSheet';
import { buildVoiceTools } from '@/ai/agent/voiceTools';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import { useSyncStore } from '@/store/useSyncStore';
import { AvatarRing } from '@/components/gamification/AvatarRing';
import { HexRadar } from '@/components/gamification/HexRadar';
import { XpBar } from '@/components/gamification/XpBar';
import { StreakFlame } from '@/components/gamification/StreakFlame';
import { QuestCard } from '@/components/gamification/QuestCard';
import { QuestDetailSheet } from '@/components/gamification/QuestDetailSheet';
import type { Quest } from '@/constants/gamification';
import { STREAK_META, type StreakKey } from '@/constants/gamification';
import { xpProgressInLevel, XP_VALUES } from '@/utils/gamification';
import { getRoutineBlocksByDate, updateRoutineBlockStatus, setRoutineBlockCalendarEventId } from '@/db/queries/routine';
import { cloneRoutineToDate } from '@/utils/starterRoutine';
import { subDays } from 'date-fns';
import { useFlagStore } from '@/store/useFlagStore';
import { getUserProfile } from '@/db/queries/userProfile';
import { refreshInferredPreferences } from '@/ai/profileLearning';
import { upsertUserProfile } from '@/db/queries/userProfile';
import { useReplanFlow } from '@/hooks/useReplanFlow';
import { track, EVENTS } from '@/utils/telemetry';
import { maybeEmitAppOpened } from '@/utils/retention';
import { getUser } from '@/db/queries/users';
import { isCalendarConnected, startCalendarOAuth, clearCalendarTokens } from '@/integrations/googleCalendar/oauth';
import { syncBlocksToCalendar } from '@/integrations/googleCalendar/client';
import { updateUser } from '@/db/queries/users';
import { getOrCreateGamification } from '@/db/queries/gamification';
import { logBehaviourEvent, generateWeeklyInsight } from '@/db/queries/behaviour';
import { useScreenTracking } from '@/hooks/useScreenTracking';
import { enqueueXPReward } from '@/store/useRewardQueueStore';
import { useDomainHistoryStore } from '@/store/useDomainHistoryStore';
import type { DomainKey } from '@/components/ui/DomainGlyph';

export default function TodayScreen() {
  const c = useColors();
  const router = useRouter();
  useScreenTracking('today');
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
  const completeBlock = useGameStore((s) => s.completeBlock);
  const triggerStreak = useGameStore((s) => s.triggerStreak);
  const streaks = useGameStore((s) => s.streaks);
  const totalXP = useGameStore((s) => s.totalXP);
  const quests = useGameStore((s) => s.quests);
  const gameDomainScores = useGameStore((s) => s.domainScores);
  // `today` lives in state so a focus that crosses midnight re-keys queries
  // onto the new date. Without this, completing a block at 12:01am writes to
  // yesterday's routine (walkthrough P0-3).
  const [today, setToday] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [blocks, setBlocks] = useState<ReturnType<typeof getRoutineBlocksByDate>>([]);
  // `loaded` separates "haven't queried yet" from "queried and got nothing",
  // so we can show a skeleton instead of the empty-state on first paint.
  const [loaded, setLoaded] = useState(false);
  const onboardingV2 = useFlagStore((s) => s.isEnabled('onboarding_v2'));
  // The acting coach supersedes the read-only "what next" card when enabled, so
  // only one of the two shows.
  const coachActionsEnabled = useFlagStore((s) => s.isEnabled('ai_coach_actions'));
  const [domainScores, setDomainScores] = useState({
    goals: 0, health: 0, finance: 0, career: 0, social: 0, polymath: 0,
  });
  const [weeklyInsight, setWeeklyInsight] = useState<string | null>(null);
  const [hasReflectedToday, setHasReflectedToday] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  // Read-only tools that let the voice assistant ground answers in the user's
  // real data (routine, goals, momentum, sleep, contacts, spending). Rebuilt only
  // when the user or the day changes; undefined until signed in.
  const voiceTools = useMemo(
    () => (userId ? buildVoiceTools({ userId, today }) : undefined),
    [userId, today],
  );
  const voiceSystemInstruction =
    "You are LifeOS's voice assistant — the user's Digital Life Architect. This is a " +
    'spoken conversation, so reply in 1-3 natural sentences: no markdown, no bullet lists. ' +
    'You have read-only tools that see the user\'s REAL data: goals, today\'s routine, recent ' +
    'sleep, gamification momentum, overdue contacts, recent spending, and today\'s nutrition ' +
    '(calories/macros vs target). ALWAYS call the ' +
    'relevant tool before answering anything about their day, plans, health, food, money, or ' +
    'progress — never guess or invent data. Ground every answer in what the tools return, and ' +
    'be specific and actionable. If a tool comes back empty, say so plainly and suggest the fix ' +
    '(e.g. plan the day, add your age for calories, or sync accounts for spending).';
  const [calConnected, setCalConnected] = useState(false);
  const [calSyncing, setCalSyncing] = useState(false);
  const [calStatus, setCalStatus] = useState<string | null>(null);

  const handleCalendarConnect = async () => {
    const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setCalStatus('Missing EXPO_PUBLIC_GOOGLE_CLIENT_ID — see .env.example.');
      return;
    }
    try {
      await startCalendarOAuth(clientId);
    } catch (err) {
      setCalStatus(err instanceof Error ? err.message : 'Calendar connect failed');
    }
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
    // Re-derive the current date on every load so a focus that crossed
    // midnight rolls forward instead of writing to yesterday.
    const currentToday = format(new Date(), 'yyyy-MM-dd');
    if (currentToday !== today) setToday(currentToday);
    // Daily roll-forward — if today has no blocks but yesterday did, clone
    // yesterday's schedule to today with fresh (unchecked) status. Idempotent.
    let todayBlocks = getRoutineBlocksByDate(currentToday);
    if (todayBlocks.length === 0) {
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      cloneRoutineToDate(currentToday, yesterday);
      todayBlocks = getRoutineBlocksByDate(currentToday);
    }
    setBlocks(todayBlocks);
    if (userId) {
      const game = getOrCreateGamification(userId);
      try {
        const parsed = JSON.parse(game.domainScores) as Record<string, number>;
        // Coalesce legacy `mind` → `polymath` (BUG-009 rename).
        setDomainScores({ ...parsed, polymath: parsed.polymath ?? parsed.mind ?? 0 } as typeof domainScores);
      } catch { /* keep defaults */ }
      loadGame(userId);
    }
    setWeeklyInsight(generateWeeklyInsight());
    setHasReflectedToday(getReflectionByDate(currentToday) !== undefined);
    // P3-04: re-run behaviour pattern detectors after any block list refresh.
    useBehaviourSuggestionsStore.getState().refresh();
    setLoaded(true);
  }, [today, userId, loadGame]);

  const topStreaks = useMemo(() => {
    return (Object.keys(STREAK_META) as StreakKey[])
      .map((k) => ({ key: k, ...streaks[k] }))
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, 3);
  }, [streaks]);

  const prog = useMemo(() => xpProgressInLevel(totalXP), [totalXP]);

  // Re-run the loader when the sync engine applies a remote pull (Increment 3),
  // so synced data (goals, today's routine) repaints without a manual reload.
  const syncTick = useSyncStore((s) => s.appliedTick);

  useFocusEffect(useCallback(() => {
    loadData();
    setCalConnected(isCalendarConnected());
    // Day-7 retention probe — once-per-UTC-day with days_since_install.
    // The helper is self-throttled via localStorage/AsyncStorage so repeated
    // focuses in the same day are no-ops.
    if (userId) maybeEmitAppOpened(getUser()?.installDate ?? null);
    // Weekly profile learning — fire-and-forget; no-ops within the 7-day window.
    if (onboardingV2 && userId) {
      refreshInferredPreferences(userId).then((result) => {
        if (result?.hasSignal) {
          track(EVENTS.profileInferenceRun, {
            events: result.sampleSize.events,
            blocks: result.sampleSize.blocks,
            productive_hours: result.preferences.productiveHours.length,
            dropped_habits: result.preferences.droppedHabits.length,
          });
        }
      }).catch(() => { /* non-fatal */ });
    }
  }, [loadData, onboardingV2, userId, syncTick]));

  const handleComplete = (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    updateRoutineBlockStatus(blockId, 'completed');
    logBehaviourEvent('block_completed', block?.module ?? 'goal');
    // Tag the goal link so completing a goal-linked block is measurable — this
    // is the join key for the north-star "weekly loop-closers" metric.
    track(EVENTS.routineBlockCompleted, {
      module: block?.module ?? 'goal',
      goal_linked: !!block?.linkedEntityId,
      linked_entity_id: block?.linkedEntityId ?? undefined,
    });
    useAmbientEventStore.getState().fireSweep(block?.module === 'health' ? '#00C896' : block?.module === 'finance' ? '#F0B429' : block?.module === 'career' ? '#5B4FE8' : block?.module === 'social' ? '#FF4D8B' : block?.module === 'polymath' ? '#00B4D8' : '#FF6B35');
    // First-block-ever telemetry (v2 funnel). Stamps the profile so it fires once.
    if (onboardingV2 && userId) {
      (async () => {
        try {
          const profile = await getUserProfile(userId);
          if (profile && !profile.firstBlockCompletedAt) {
            const stamped = { ...profile, firstBlockCompletedAt: new Date().toISOString() };
            await upsertUserProfile(userId, stamped);
            track(EVENTS.firstBlockCompleted, {
              module: block?.module ?? 'goal',
              source: profile.source,
            });
          }
        } catch { /* non-fatal */ }
      })();
    }
    if (userId) {
      const mod = block?.module ?? 'goal';
      const todayBlocks = blocks.filter(b => b.module === mod);
      const completed = todayBlocks.filter(b => b.id === blockId || b.status === 'completed').length;
      // completeBlock credits the XP itself — do NOT also addXP here (that was
      // the double-credit in QA RW-01). The beat below is purely visual.
      completeBlock(userId, mod, completed, todayBlocks.length || 1);
      // Aurora XP beat — flyaway chip near the top of the screen. Map the
      // routine-block `module` to a canonical domain; non-domain modules
      // (rest/meal/work/…) pass `undefined` so the beat renders without a
      // glyph rather than feeding DomainGlyph a key it can't resolve.
      // DomainKey (the glyph/icon key space) uses 'goal' (singular), unlike the
      // DomainScores key 'goals'. Only the 6 canonical domains have a glyph;
      // other modules (rest/meal/work/…) map to undefined → beat shows no glyph.
      const MODULE_TO_GLYPH: Record<string, DomainKey> = {
        goal: 'goal', health: 'health', finance: 'finance',
        career: 'career', social: 'social', polymath: 'polymath',
      };
      enqueueXPReward(XP_VALUES.completeBlock, MODULE_TO_GLYPH[mod]);
      const streakMap: Record<string, 'workout' | 'learning' | 'social'> = {
        health: 'workout',
        polymath: 'learning',
        social: 'social',
      };
      const streakKey = streakMap[mod];
      if (streakKey) triggerStreak(userId, streakKey);
    }
    loadData();
  };

  const [showYesterday, setShowYesterday] = useState(false);
  const handleYesterdayLogged = (mod: string) => {
    // Backfilled completion — credit the domain score + XP, same as a same-day
    // completion, so a forgotten check-in still counts.
    if (!userId) return;
    // completeBlock credits XP itself — no extra addXP (QA double-credit fix).
    completeBlock(userId, mod, 1, 1);
  };

  const handleUncomplete = (blockId: string) => {
    // Flip a mistakenly-completed block back to upcoming. We intentionally do
    // NOT claw back the XP/streak already awarded — reversing the gamification
    // ledger risks negative balances; re-completing simply won't double-award
    // within the same day.
    updateRoutineBlockStatus(blockId, 'upcoming');
    loadData();
  };

  const skippedCount = useMemo(() => blocks.filter((b) => b.status === 'skipped').length, [blocks]);

  const replanFlow = useReplanFlow({
    userId,
    today,
    primaryDomains,
    skippedCount,
    onboardingV2,
    refresh: loadData,
  });
  const { replanning, planningWeek, rationale: replanRationale, showReplanCta, handleReplan, handlePlanWeek } = replanFlow;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const completedCount = blocks.filter((b) => b.status === 'completed').length;
  const allComplete = blocks.length > 0 && completedCount === blocks.length;

  // P4-02: assemble the morning briefing input from the slices the Today
  // screen already has loaded. The hook generates 1-3 lines once per day and
  // caches them; we fall back to the static blocks-count line below if it's
  // still generating or failed.
  // Queries run in useEffect (not useMemo) so React doesn't hit storage on
  // every render — only when the dependencies that affect the briefing change.
  const [briefingInput, setBriefingInput] = useState<DailyBriefingInput | null>(null);
  useEffect(() => {
    if (!userId) { setBriefingInput(null); return; }
    const goals = getGoalsByUser(userId);
    const lifeGoal = goals.find((g) => g.level === 'life') ?? goals[0];
    const overdueContacts = getContactsByUser(userId)
      .filter((ct) => computeOverdue(ct).isOverdue).length;
    const score = computeLifeScore(domainScores, primaryDomains);
    const yesterday = useDomainHistoryStore.getState().yesterdaySnapshot();
    const topDomainYesterday = yesterday
      ? Object.entries(yesterday).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] ?? null
      : null;
    setBriefingInput({
      name,
      topGoal: lifeGoal?.title ?? null,
      blocksToday: blocks.length,
      overdueContacts,
      lifeScore: score,
      lifeScoreBand: lifeScoreBand(score).label,
      weeklyInsight,
      topDomainYesterday,
    });
  }, [userId, blocks.length, domainScores, primaryDomains, name, weeklyInsight]);

  const briefingText = useDailyBriefing(briefingInput, today);

  // Fire the confetti once per day when the last block flips to complete.
  // celebratedRef holds the date we last celebrated, so re-focusing or
  // un/re-checking a block doesn't re-trigger the burst.
  const [showConfetti, setShowConfetti] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const celebratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (allComplete && celebratedRef.current !== today) {
      celebratedRef.current = today;
      setShowConfetti(true);
    }
    // Note: we used to reset celebratedRef to null on !allComplete so an undo +
    // re-complete would re-celebrate. That re-fires the burst on every toggle
    // cycle, which is annoying for testers. Once-per-day is the right rule.
  }, [allComplete, today]);

  // Avatar initials
  const initials = (name || 'U')
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '')
    .join('');

  const densityScale = useDensityScale();
  const gamification = usePreferencesStore((s) => s.gamification);
  const styles = makeStyles(c, densityScale);

  const scrollY = useSharedValue(0);
  // The sticky collapsed band overlays the top of the screen. While the hero is
  // visible it's invisible (opacity 0) but its child Pressables would still
  // capture touches — covering the top hex icon (goals). Track collapse state
  // (only on threshold crossing) so the band can ignore touches until shown.
  const [heroCollapsed, setHeroCollapsed] = useState(false);
  const [openQuest, setOpenQuest] = useState<Quest | null>(null);
  const collapsedSV = useSharedValue(false);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
    const collapsed = e.contentOffset.y > 140;
    if (collapsed !== collapsedSV.value) {
      collapsedSV.value = collapsed;
      runOnJS(setHeroCollapsed)(collapsed);
    }
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
  const stagger = useStaggerDelay();
  const radarScores = gameDomainScores.goals !== undefined ? gameDomainScores : domainScores;
  // Select the raw entries (stable reference unless data actually changes) and
  // derive the snapshot via useMemo. Selecting the result of `yesterdaySnapshot()`
  // directly returns a new object every call, which zustand sees as a state
  // change → re-render → re-select → infinite loop (React error #185).
  const historyEntries = useDomainHistoryStore((s) => s.entries);
  const yesterdayScores = useMemo(() => {
    const out: Partial<typeof radarScores> = {};
    let any = false;
    for (const [key, arr] of Object.entries(historyEntries) as Array<[keyof typeof radarScores, Array<{ date: string; score: number }>]>) {
      if (!arr || arr.length < 2) continue;
      out[key] = arr[arr.length - 2]!.score;
      any = true;
    }
    return any ? out : null;
  }, [historyEntries]);

  return (
    <View style={styles.root}>
      <AuroraBackground scrollY={scrollY} allBlocksDone={allComplete} />
      <SafeAreaView style={styles.container}>

        <Animated.ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {/* Hex radar hero — solid line is today, dashed faint line is yesterday.
              Tapping a domain dot routes to the matching tab. */}
          <Animated.View
            entering={FadeIn.delay(280).duration(600)}
            style={[styles.heroWrap, heroStyle]}
          >
            <HexRadar
              scores={radarScores}
              yesterdayScores={yesterdayScores as React.ComponentProps<typeof HexRadar>['yesterdayScores']}
              size={340}
              onDomainPress={(domain) => {
                const route = (
                  domain === 'goals' ? '/(tabs)/goals'
                  : domain === 'health' ? '/(tabs)/health'
                  : domain === 'finance' ? '/(tabs)/finance'
                  : domain === 'career' ? '/(tabs)/career'
                  : domain === 'polymath' ? '/(tabs)/explore'
                  : domain === 'social' ? '/(tabs)/social'
                  : null
                );
                if (route) router.push(route);
              }}
            />
          </Animated.View>

          {/* Header */}
          <Animated.View entering={FadeIn.delay(0).duration(600)} style={styles.header}>
            <Pressable onPress={() => router.push('/(tabs)/profile')} hitSlop={8}>
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
            <Pressable
              onPress={() => router.push('/feedback')}
              hitSlop={8}
              style={[styles.feedbackBtn, { backgroundColor: c.warning + '1A', borderColor: c.warning + '55' }]}
              testID="feedback-open"
              accessibilityRole="button"
              accessibilityLabel="Send feedback"
            >
              <Ionicons name="bug-outline" size={18} color={c.warning} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Heading style={{ color: c.textPrimary }}>{greeting}, {name || 'there'}</Heading>
              <AuroraText variant="micro" muted style={{ marginTop: 2 }}>
                {format(new Date(), 'EEEE · MMMM d').toUpperCase()}
              </AuroraText>
              {gamification !== 'off' && (
                <View style={styles.xpRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    {gamification === 'full' && (
                      <View style={styles.xpLabelRow}>
                        <AuroraText variant="micro" muted>
                          {`L${prog.level} → L${prog.level + 1}`}
                        </AuroraText>
                        <AuroraText variant="caption" numeric color={c.xp}>
                          {`${prog.current}/${prog.needed} XP`}
                        </AuroraText>
                      </View>
                    )}
                    <XpBar pct={prog.pct} color={c.primary} height={6} />
                  </View>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Streak rail — Aurora 5-up tile grid (hidden when gamification minimal/off) */}
          {gamification === 'full' && topStreaks.some((s) => (s.count ?? 0) > 0) && (
            <View style={styles.streaksSection}>
              <SectionLabel>{`STREAKS · ${topStreaks.filter((s) => (s.count ?? 0) > 0).length}`}</SectionLabel>
              <View style={styles.streakGrid}>
                {topStreaks.map((s) => {
                  const meta = STREAK_META[s.key];
                  const color = c[meta.colorKey];
                  const active = (s.count ?? 0) > 0;
                  return (
                    <View
                      key={s.key}
                      style={[
                        styles.streakTile,
                        {
                          backgroundColor: active ? color + '1F' : c.surfaceAlt,
                          borderColor: active ? color + '44' : c.border,
                        },
                      ]}
                    >
                      <StreakFlame
                        count={s.count ?? 0}
                        graceUsed={s.graceUsed ?? false}
                        size="sm"
                      />
                      <AuroraText variant="micro" color={active ? color : c.textMuted}>
                        {meta.label.toUpperCase()}
                      </AuroraText>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Active Quests (hidden when gamification off) */}
          {gamification === 'full' && quests.length > 0 && (
            <View style={styles.questsSection}>
              <Body style={styles.sectionLabel}>ACTIVE QUESTS</Body>
              <View style={styles.questList}>
                {quests.slice(0, 3).map((q) => (
                  <QuestCard key={q.id} quest={q} compact onPress={() => setOpenQuest(q)} />
                ))}
              </View>
            </View>
          )}

          {allComplete && (
            <Animated.View entering={FadeInDown.duration(400)}>
              <GlassCard accent={c.success} onPress={() => setShowSummary(true)} style={styles.reflectCard}>
                <View style={styles.reflectRow}>
                  <View style={[styles.wrapBadge, { backgroundColor: c.success + '22', borderColor: c.success + '55' }]}>
                    <Ionicons name="sparkles" size={18} color={c.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AuroraText variant="bodyLg">Every block done</AuroraText>
                    <AuroraText variant="caption" muted style={{ marginTop: 2 }}>
                      Tap for your daily summary
                    </AuroraText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
                </View>
              </GlassCard>
            </Animated.View>
          )}

          {blocks.length > 0 && new Date().getHours() >= 18 && !hasReflectedToday && (
            <Animated.View entering={FadeInDown.delay(180).duration(400)}>
              <GlassCard
                accent={c.polymath}
                onPress={() => router.push('/evening-reflect')}
                style={styles.reflectCard}
              >
                <View style={styles.reflectRow}>
                  <View style={[styles.wrapBadge, { backgroundColor: c.polymath + '22', borderColor: c.polymath + '55' }]}>
                    <AuroraText variant="h3" color={c.polymath}>✦</AuroraText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AuroraText variant="bodyLg">Wrap up the day</AuroraText>
                    <AuroraText variant="caption" muted style={{ marginTop: 2 }}>
                      60 seconds · sets up tomorrow's plan
                    </AuroraText>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
                </View>
              </GlassCard>
            </Animated.View>
          )}
          {hasReflectedToday && (
            <Animated.View entering={FadeInDown.delay(180).duration(400)}>
              <GlassCard accent={c.success} style={styles.reflectCard}>
                <View style={styles.reflectRow}>
                  <Ionicons name="checkmark-circle" size={22} color={c.success} />
                  <AuroraText variant="body" secondary style={{ flex: 1 }}>
                    Reflection logged. Tomorrow is ready.
                  </AuroraText>
                </View>
              </GlassCard>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <DailyBriefing
              text={briefingText ?? (blocks.length > 0
                ? `You have ${blocks.length} blocks planned today. ${completedCount} completed so far. Keep going!`
                : 'No routine set up yet. Complete onboarding to get your personalised daily plan.')
              }
              ctaLabel={blocks.length === 0 ? 'Complete onboarding' : undefined}
              onCtaPress={blocks.length === 0 ? startOnboarding : undefined}
            />
          </Animated.View>

          {blocks.length > 0 && (
            <Animated.View entering={FadeInDown.delay(140).duration(400)}>
              <LifeScoreHero />
            </Animated.View>
          )}

          {blocks.length > 0 && (
            <Animated.View entering={FadeInDown.delay(180).duration(400)}>
              <AdaptationCard onApplied={loadData} />
            </Animated.View>
          )}

          {blocks.length > 0 && (
            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
              {coachActionsEnabled ? <CoachActionsCard /> : <WhatNextCard />}
            </Animated.View>
          )}

          {blocks.length > 0 && (
            <Animated.View entering={FadeInDown.delay(220).duration(400)}>
              <WeeklyBalanceCard
                primaryDomains={primaryDomains}
                onRebalanceTomorrow={() => void handlePlanWeek()}
              />
              <Pressable
                onPress={handlePlanWeek}
                disabled={planningWeek}
                style={({ pressed }) => [
                  styles.weekPlanBtn,
                  {
                    backgroundColor: pressed ? c.card : c.surface,
                    borderColor: c.border,
                    opacity: planningWeek ? 0.6 : 1,
                  },
                ]}
              >
                {planningWeek
                  ? <ActivityIndicator size="small" color={c.primary} />
                  : <Ionicons name="calendar" size={16} color={c.primary} />}
                <Body style={{ color: c.textPrimary, flex: 1 }}>
                  {planningWeek ? 'Planning your week…' : 'Plan my next 7 days'}
                </Body>
                {!planningWeek && <Ionicons name="chevron-forward" size={16} color={c.textMuted} />}
              </Pressable>
              <Pressable
                onPress={() => router.push('/monthly-insight')}
                style={({ pressed }) => [
                  styles.weekPlanBtn,
                  {
                    backgroundColor: pressed ? c.card : c.surface,
                    borderColor: c.border,
                  },
                ]}
              >
                <Ionicons name="bar-chart" size={16} color={c.primary} />
                <Body style={{ color: c.textPrimary, flex: 1 }}>View your 28-day report</Body>
                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
              </Pressable>
              <Pressable
                onPress={() => router.push('/annual-review')}
                style={({ pressed }) => [
                  styles.weekPlanBtn,
                  {
                    backgroundColor: pressed ? c.card : c.surface,
                    borderColor: c.border,
                  },
                ]}
              >
                <Ionicons name="sparkles-outline" size={16} color={c.primary} />
                <Body style={{ color: c.textPrimary, flex: 1 }}>Your journey so far</Body>
                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
              </Pressable>
              <Pressable
                onPress={() => setShowYesterday(true)}
                style={({ pressed }) => [
                  styles.weekPlanBtn,
                  { backgroundColor: pressed ? c.card : c.surface, borderColor: c.border },
                ]}
              >
                <Ionicons name="time-outline" size={16} color={c.primary} />
                <Body style={{ color: c.textPrimary, flex: 1 }}>Log yesterday's progress</Body>
                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
              </Pressable>
            </Animated.View>
          )}

          {weeklyInsight && (
            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <GlassCard accent={c.primary} style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <Ionicons name="analytics-outline" size={14} color={c.primary} />
                  <SectionLabel color={c.primary}>WEEKLY INSIGHT</SectionLabel>
                </View>
                <AuroraText variant="bodyLg" secondary>{weeklyInsight}</AuroraText>
              </GlassCard>
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

          {!loaded ? (
            // First-paint skeleton — keeps the empty-state from flashing while
            // SQLite/localStorage resolves. The Skeleton component delays
            // shimmer until 300ms so fast queries just paint solid.
            <View style={styles.blocksSection}>
              <Skeleton height={20} width={160} style={{ marginBottom: spacing.md }} />
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={72} radius={20} style={{ marginBottom: spacing.sm }} />
              ))}
            </View>
          ) : blocks.length > 0 ? (
            <View style={styles.blocksSection}>
              <View style={styles.routineHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
                  <AuroraText variant="h3">Today's flow</AuroraText>
                  <AuroraText variant="micro" numeric color={c.success}>
                    {`${completedCount}/${blocks.length} DONE`}
                  </AuroraText>
                </View>
                <Pressable
                  style={[styles.editRoutineBtn, { borderColor: c.border, backgroundColor: c.surface }]}
                  onPress={() => {
                    // Blur active element before navigating so the prior
                    // screen can be aria-hidden without retaining focus on
                    // the (now-invisible) button. Fixes the W3C aria-hidden
                    // warning on web during route transitions.
                    if (typeof document !== 'undefined') {
                      (document.activeElement as HTMLElement | null)?.blur();
                    }
                    router.push('/(onboarding)/day1-routine?mode=edit');
                  }}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Edit routine"
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

              {(showReplanCta || replanning || replanRationale) ? (
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
                  {replanning
                    ? <ActivityIndicator size="small" color={c.primary} />
                    : <Ionicons name="refresh" size={20} color={c.primary} />}
                  <View style={{ flex: 1 }}>
                    <Body style={{ color: c.textPrimary, fontFamily: fonts.heading }}>
                      {replanning ? 'Re-planning the rest of today…' : replanRationale ?? 'Day off track?'}
                    </Body>
                    {!replanning && !replanRationale ? (
                      <Caption style={{ color: c.textSecondary, marginTop: 4 }}>
                        {skippedCount} skipped — let me rebalance what's left.
                      </Caption>
                    ) : null}
                  </View>
                  {!replanning && !replanRationale ? (
                    <Pressable
                      onPress={handleReplan}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        backgroundColor: c.primary,
                        borderRadius: 12,
                      }}
                    >
                      <Caption style={{ color: '#fff', fontFamily: fonts.heading }}>Re-plan</Caption>
                    </Pressable>
                  ) : null}
                </Card>
              ) : null}

              {blocks
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map((block, i) => (
                  <Animated.View
                    key={block.id}
                    entering={FadeIn.delay(420 + stagger(i)).duration(420)}
                  >
                    <RoutineBlock
                      id={block.id}
                      startTime={block.startTime}
                      endTime={block.endTime}
                      title={block.title}
                      module={block.module}
                      status={block.status}
                      onComplete={handleComplete}
                      onUncomplete={handleUncomplete}
                    />
                  </Animated.View>
                ))}
            </View>
          ) : (
            <EmptyState
              icon="calendar-outline"
              title="No routine yet"
              caption="Complete onboarding to get started"
            />
          )}
        </Animated.ScrollView>

        {/* Sticky compact band — fades in after the hero has scrolled away. */}
        <Animated.View
          style={[styles.collapsedHeader, chipStyle]}
          pointerEvents={heroCollapsed ? 'box-none' : 'none'}
        >
          <View style={[styles.collapsedChip, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Pressable onPress={() => router.push('/(tabs)/profile')} hitSlop={6}>
              <AvatarRing xp={totalXP} initials={initials || 'U'} size={32} />
            </Pressable>
            <View style={{ gap: 2 }}>
              <AuroraText variant="caption">Today</AuroraText>
              <AuroraText variant="micro" muted>
                {`balance ${Math.round(
                  (radarScores.goals + radarScores.health + radarScores.finance +
                   radarScores.career + radarScores.social + radarScores.polymath) / 6,
                )} · ${completedCount} of ${blocks.length} done`}
              </AuroraText>
            </View>
            <Pressable
              onPress={() => setVoiceOpen(true)}
              hitSlop={6}
              style={{ marginLeft: spacing.sm, padding: 4 }}
            >
              <Ionicons name="mic" size={16} color={c.primary} />
            </Pressable>
          </View>
        </Animated.View>
      </SafeAreaView>

      <VoiceAssistantSheet
        visible={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        systemInstruction={voiceSystemInstruction}
        tools={voiceTools}
      />

      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
      <DailySummarySheet
        visible={showSummary}
        onClose={() => setShowSummary(false)}
        blocks={blocks.map((b) => ({ title: b.title, module: b.module }))}
      />
      <YesterdayLogSheet
        visible={showYesterday}
        onClose={() => setShowYesterday(false)}
        onLogged={handleYesterdayLogged}
      />
      <QuestDetailSheet
        quest={openQuest}
        visible={openQuest !== null}
        onClose={() => setOpenQuest(null)}
        onChanged={loadData}
      />
    </View>
  );
}

function makeStyles(c: ReturnType<typeof useColors>, density = 1) {
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
      paddingHorizontal: Math.round(spacing.xl * density),
      paddingBottom: Math.round(spacing.xxxl * density),
      gap: Math.round(spacing.md * density),
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
    feedbackBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    xpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    radarWrap: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
    heroWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
      position: 'relative',
    },
    heroOverlay: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    xpLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
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
    streakGrid: {
      flexDirection: 'row',
      gap: 6,
      flexWrap: 'wrap',
    },
    streakTile: {
      flex: 1,
      minWidth: 56,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: radii.control,
      borderWidth: 1,
      alignItems: 'center',
      gap: spacing.xs,
    },
    wrapBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
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
    weekPlanBtn: {
      marginTop: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: 14,
      borderWidth: 1,
    },
  });
}
