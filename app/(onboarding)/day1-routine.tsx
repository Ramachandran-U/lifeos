import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { NarrationToggle } from '@/components/shared/NarrationToggle';
import { OnboardingIntroSection } from '@/components/shared/OnboardingIntroSection';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Body, Heading, Label, Caption } from '@/components/ui/Typography';
import { WheelTimePicker } from '@/components/ui/WheelTimePicker';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { DraggableRoutineList } from '@/components/shared/DraggableRoutineList';
import { DomainBalanceBar } from '@/components/shared/DomainBalanceBar';
import { aggregatePlannedDomainMinutes } from '@/utils/routineBalance';
import { reorderBlocksFixedSlots } from '@/utils/routineReorder';
import { useAI } from '@/hooks/useAI';
import { useNarration } from '@/hooks/useNarration';
import { planRoutineWithContext } from '@/ai/routinePlanner';
import { selectPlannerGoals } from '@/db/queries/goals';
import { useUserStore, ONBOARDING_COMPLETE } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import { track, EVENTS } from '@/utils/telemetry';
import { getUser, updateUser } from '@/db/queries/users';
import { getInterestsByUser } from '@/db/queries/interests';
import { createRoutineBlocks, deleteRoutineBlocksByDate } from '@/db/queries/routine';
import { mirrorScheduleToProfile } from '@/utils/scheduleSync';
import type { GeneratedRoutine } from '@/ai/types';

// All 48 half-hour slots in a 24-hour day. Stored as "HH:mm" so downstream
// code (createRoutineBlocks, AI prompts, calendar sync) stays untouched.
const ALL_TIME_SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return out;
})();

function toMin(t: string): number {
  const [h, m] = t.split(':').map((s) => parseInt(s, 10));
  return h * 60 + (m || 0);
}

function to12Hour(value: string): string {
  const [hStr, mStr] = value.split(':');
  const h = Number(hStr);
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${mStr} ${period}`;
}

function TimePicker({ options, selected, onSelect, label }: {
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  label: string;
}) {
  const c = useColors();
  const pickerStyles = makePickerStyles(c);
  return (
    <View style={pickerStyles.container}>
      <Label>{label}</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={pickerStyles.scroll}>
        {options.map((time) => (
          <Pressable
            key={time}
            style={[pickerStyles.pill, selected === time && pickerStyles.pillActive]}
            onPress={() => onSelect(time)}
          >
            <Body style={[pickerStyles.text, selected === time && pickerStyles.textActive]}>
              {time}
            </Body>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default function Day1RoutineScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const MODULE_COLORS: Record<string, string> = {
    goal: c.goal,
    health: c.health,
    finance: c.finance,
    career: c.career,
    social: c.social,
    polymath: c.polymath,
    rest: c.textMuted,
    work: c.textSecondary,
    meal: c.warning,
  };
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isEditMode = mode === 'edit';
  const { call, loading, error } = useAI();
  const narration = useNarration('day1-routine');
  const { userId, setOnboardingStage } = useUserStore();
  const { awardBadge } = useGameStore();

  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('22:30');
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('17:00');
  const [routine, setRoutine] = useState<GeneratedRoutine | null>(null);
  const [filterDebug, setFilterDebug] = useState<string | null>(null);
  // Disable page scroll while a routine card is being dragged.
  const [dragActive, setDragActive] = useState(false);

  // Fixed-slot reorder: move the activity, keep the time windows pinned.
  const handleReorder = useCallback((from: number, to: number) => {
    setRoutine((prev) => (prev ? { ...prev, blocks: reorderBlocksFixedSlots(prev.blocks, from, to) } : prev));
    Haptics.selectionAsync().catch(() => undefined);
  }, []);

  // Seed pickers from the persisted user row so re-entering this screen (esp.
  // in edit mode) doesn't silently revert wake/sleep/work times to defaults
  // and feed those stale values to the AI when "Generate" is pressed.
  useEffect(() => {
    const user = getUser();
    if (!user) return;
    if (user.wakeTime) setWakeTime(user.wakeTime);
    if (user.sleepTime) setSleepTime(user.sleepTime);
    if (user.workStartTime) setWorkStart(user.workStartTime);
    if (user.workEndTime) setWorkEnd(user.workEndTime);
  }, []);

  const scheduleError = (() => {
    if (toMin(wakeTime) >= toMin(workStart)) {
      return 'Wake time must be earlier than work start time.';
    }
    if (toMin(workEnd) >= toMin(sleepTime)) {
      return 'Sleep time must be later than work end time.';
    }
    return null;
  })();

  const handleGenerate = async () => {
    if (scheduleError) return;

    // Persist the user's schedule BEFORE generating so the users table is always
    // up-to-date (the post-generate handleSave was too late — "Plan my next 7
    // days" reads from the users table, and a stale record means it uses the old
    // wake time). This also surfaces the correct times if the user abandons
    // without saving.
    if (userId) {
      updateUser(userId, {
        wakeTime,
        sleepTime,
        workStartTime: workStart,
        workEndTime: workEnd,
      });
    }

    if (__DEV__) console.log('[routine] generating with schedule:', { wakeTime, sleepTime, workStart, workEnd });

    // Reserve weekly minutes for any interest the user has flagged "protect time".
    const protectedInterests = userId
      ? getInterestsByUser(userId)
          .filter((i) => i.timeProtected && i.status !== 'deleted')
          .map((i) => ({ name: i.name, weeklyMinutes: i.weeklyMinutesTarget }))
      : [];

    // Feed the user's live goals into the plan (P1 bridge) — so re-generating
    // from the routine editor reflects the goals they've set, not nothing.
    const plannerGoals = userId ? selectPlannerGoals(userId, []) : [];

    const raw = await call(() =>
      planRoutineWithContext({
        wakeTime,
        sleepTime,
        workStartTime: workStart,
        workEndTime: workEnd,
        goals: plannerGoals,
        protectedInterests: protectedInterests.length > 0 ? protectedInterests : undefined,
      })
    );

    if (raw) {
      const wMin = toMin(wakeTime);
      const sMin = toMin(sleepTime);
      const safeBlocks = raw.blocks.filter((b) => {
        const bs = toMin(b.startTime);
        const be = toMin(b.endTime);
        return bs >= wMin && be <= sMin && bs < be;
      });

      console.warn(
        `[routine-guard] wakeTime=${wakeTime}(${wMin}) sleepTime=${sleepTime}(${sMin}) ` +
        `raw=${raw.blocks.length} blocks (starts: ${raw.blocks.map(b => b.startTime).join(',')}) ` +
        `safe=${safeBlocks.length} blocks (starts: ${safeBlocks.map(b => b.startTime).join(',')})`,
      );
      setFilterDebug(
        `Guard: wake=${wakeTime} sleep=${sleepTime} | AI gave ${raw.blocks.length} blocks → ${safeBlocks.length} kept`,
      );

      if (safeBlocks.length === 0) {
        setRoutine(null);
      } else {
        setRoutine({ ...raw, blocks: safeBlocks });
        // "Your day is ready" beat as the blueprint stages in.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  };

  const handleSave = async () => {
    if (!routine || !userId) return;

    const today = format(new Date(), 'yyyy-MM-dd');

    // Edit mode — replace today's existing schedule rather than appending,
    // so the user doesn't end up with duplicate blocks.
    if (isEditMode) {
      deleteRoutineBlocksByDate(today);
    }

    createRoutineBlocks(
      routine.blocks.map((block) => ({
        date: today,
        startTime: block.startTime,
        endTime: block.endTime,
        title: block.title,
        module: block.module,
        energyRequired: block.energyRequired,
      }))
    );

    updateUser(userId, {
      wakeTime,
      sleepTime,
      workStartTime: workStart,
      workEndTime: workEnd,
      onboardingStage: ONBOARDING_COMPLETE,
    });

    // Mirror the same schedule onto userProfile.schedule so the
    // discovery-chat generator and what-lifeos-knows stay consistent.
    // Fire-and-forget — a failure here must not block save.
    void mirrorScheduleToProfile(userId, {
      wakeTime,
      sleepTime,
      workStartTime: workStart,
      workEndTime: workEnd,
    }).catch(() => undefined);

    setOnboardingStage(ONBOARDING_COMPLETE);
    if (!isEditMode) {
      track(EVENTS.onboardingFinished, { stage: ONBOARDING_COMPLETE });
      awardBadge(userId, 'first_blueprint');
    } else {
      track(EVENTS.routineEdited, { blocks: routine.blocks.length });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (isEditMode) {
      router.replace('/(tabs)');
    } else {
      router.push('/(onboarding)/day1-voice');
    }
  };

  const pickersLocked = loading || routine !== null;

  return (
    <SafeAreaView style={styles.container}>
      <AuroraBackground />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        scrollEnabled={!dragActive}
      >
        {/* Back button (edit mode only — onboarding flow has no back) */}
        {isEditMode && (
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
            hitSlop={12}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
          </Pressable>
        )}

        {!isEditMode && <NarrationToggle narration={narration} />}
        <Animated.View entering={FadeInDown.duration(600)}>
          <Heading style={styles.title}>
            {isEditMode ? 'Edit your daily routine' : 'Build your daily routine'}
          </Heading>
          <Body style={styles.subtitle}>
            {isEditMode
              ? "Adjust your schedule — saving will replace today's blocks."
              : "Tell us your schedule and we'll design your day"}
          </Body>
        </Animated.View>

        {!isEditMode && (
          <OnboardingIntroSection
            scriptId="day1-routine"
            revealedCards={narration.revealedCards}
            accentColor={c.primary}
          />
        )}

        {/* Lock pickers once generating / generated so the user can't change
            times while the AI is working or after the result is shown. */}
        <View style={[styles.pickers, { opacity: pickersLocked ? 0.5 : 1 }]} pointerEvents={pickersLocked ? 'none' : 'auto'}>
          <WheelTimePicker label="Wake time" options={ALL_TIME_SLOTS} selected={wakeTime} onSelect={setWakeTime} formatValue={to12Hour} />
          <WheelTimePicker label="Sleep time" options={ALL_TIME_SLOTS} selected={sleepTime} onSelect={setSleepTime} formatValue={to12Hour} />
          <WheelTimePicker label="Work starts" options={ALL_TIME_SLOTS} selected={workStart} onSelect={setWorkStart} formatValue={to12Hour} />
          <WheelTimePicker label="Work ends" options={ALL_TIME_SLOTS} selected={workEnd} onSelect={setWorkEnd} formatValue={to12Hour} />
        </View>

        {scheduleError && (
          <Body style={styles.errorText}>{scheduleError}</Body>
        )}

        {!routine && !loading && (
          <Button
            title="Generate my routine"
            onPress={handleGenerate}
            disabled={!!scheduleError}
            style={styles.generateButton}
          />
        )}

        {loading && (
          <View style={styles.loadingContainer}>
            <LoadingDots />
            <Body style={styles.loadingText}>Designing your perfect day...</Body>
          </View>
        )}

        {error && (
          <Body style={styles.errorText}>
            {/^\s*\[?\s*\{/.test(error)
              ? "We couldn't build that routine — the AI returned an unexpected shape. Try adjusting your wake/sleep/work times and tap Generate again."
              : error}
          </Body>
        )}

        {filterDebug && (
          <Caption style={{ color: '#FF6B35', marginTop: spacing.sm, textAlign: 'center' }}>
            {filterDebug}
          </Caption>
        )}

        {routine && (
          <Animated.View entering={FadeInUp.duration(600)} style={styles.routinePreview}>
            <Label style={styles.previewLabel}>YOUR DAILY BLUEPRINT</Label>
            <Card style={styles.briefingCard}>
              <Body style={styles.briefing}>{routine.briefing}</Body>
            </Card>

            <DomainBalanceBar minutes={aggregatePlannedDomainMinutes(routine.blocks)} />

            <Caption style={styles.dragHint}>
              Hold and drag a card to choose what you do when — your times stay fixed.
            </Caption>

            <DraggableRoutineList
              blocks={routine.blocks}
              moduleColor={(m) => MODULE_COLORS[m] ?? c.textMuted}
              onReorder={handleReorder}
              onDragActiveChange={setDragActive}
            />

            <Button
              title="Save my routine"
              onPress={handleSave}
              style={styles.saveButton}
            />
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makePickerStyles = (c: AppColors) => StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  scroll: {
    flexGrow: 0,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    marginRight: spacing.sm,
  },
  pillActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  text: {
    color: c.textSecondary,
    fontSize: fontSizes.sm,
  },
  textActive: {
    color: c.textPrimary,
    fontFamily: fonts.bodyMedium,
  },
});

const makeStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  backBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  title: {
    marginTop: spacing.xl,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  pickers: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    rowGap: spacing.lg,
  },
  generateButton: {
    marginTop: spacing.xl,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  routinePreview: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  previewLabel: {
    color: colors.primary,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  briefingCard: {
    marginBottom: spacing.sm,
  },
  briefing: {
    color: colors.textSecondary,
    lineHeight: 22,
  },
  dragHint: {
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  saveButton: {
    marginTop: spacing.lg,
  },
});
