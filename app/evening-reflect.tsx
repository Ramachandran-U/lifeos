import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, addDays } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Button } from '@/components/ui/Button';
import { Body, Heading, Caption, Label } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { getRoutineBlocksByDate, updateRoutineBlock } from '@/db/queries/routine';
import { cloneRoutineToDate } from '@/utils/starterRoutine';
import { upsertReflection, getReflectionByDate, type BlockReview } from '@/db/queries/reflections';
import { logBehaviourEvent } from '@/db/queries/behaviour';
import { track } from '@/utils/telemetry';
import { suggestTomorrowTweak } from '@/ai/functions';
import type { TomorrowTweak } from '@/ai/types';
import { useUserStore } from '@/store/useUserStore';
import { useFlagStore } from '@/store/useFlagStore';
import { getUserProfile } from '@/db/queries/userProfile';
import { generateAndSaveTomorrow, isRecoveryLow } from '@/ai/replanApply';
import { deleteRoutineBlocksByDate } from '@/db/queries/routine';
import { getLatestSleepHours } from '@/db/queries/health';

type Step = 'blocks' | 'mood' | 'tomorrow';

const MOODS = [
  { v: 1, emoji: '😞', label: 'Rough' },
  { v: 2, emoji: '😕', label: 'Meh' },
  { v: 3, emoji: '🙂', label: 'Okay' },
  { v: 4, emoji: '😊', label: 'Good' },
  { v: 5, emoji: '🤩', label: 'Great' },
];

export default function EveningReflectScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const REVIEW_OPTIONS: Array<{ value: BlockReview; label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { value: 'did',          label: 'Did it',      color: c.success, icon: 'checkmark-circle' },
    { value: 'skipped',      label: 'Skipped',     color: c.textMuted, icon: 'close-circle' },
    { value: 'rescheduled',  label: 'Moved it',    color: c.warning, icon: 'swap-horizontal' },
  ];
  const router = useRouter();
  const primaryDomains = useUserStore((s) => s.primaryDomains);
  const userId = useUserStore((s) => s.userId);
  const onboardingV2 = useFlagStore((s) => s.isEnabled('onboarding_v2'));
  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const [step, setStep] = useState<Step>('blocks');
  const [blockReviews, setBlockReviews] = useState<Record<string, BlockReview>>({});
  const [mood, setMood] = useState<number | null>(null);
  const [tweak, setTweak] = useState<TomorrowTweak | null>(null);
  const [tweakLoading, setTweakLoading] = useState(false);
  const [tweakError, setTweakError] = useState<string | null>(null);
  const [tweakAccepted, setTweakAccepted] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const todayBlocks = useMemo(
    () => getRoutineBlocksByDate(today).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [today],
  );

  // Hydrate from any existing reflection (user may have started earlier)
  useEffect(() => {
    const existing = getReflectionByDate(today);
    if (existing) {
      setBlockReviews(existing.blockReviews);
      setMood(existing.mood);
    } else {
      const seed: Record<string, BlockReview> = {};
      todayBlocks.forEach((b) => {
        if (b.status === 'completed') seed[b.id] = 'did';
      });
      setBlockReviews(seed);
    }
  }, [today, todayBlocks]);

  const [tomorrowBlocks, setTomorrowBlocks] = useState<ReturnType<typeof getRoutineBlocksByDate>>([]);

  const loadTomorrow = useCallback(() => {
    cloneRoutineToDate(tomorrow, today);
    setTomorrowBlocks(getRoutineBlocksByDate(tomorrow).sort((a, b) => a.startTime.localeCompare(b.startTime)));
  }, [tomorrow, today]);

  const fetchTweak = useCallback(async () => {
    setTweakLoading(true);
    setTweakError(null);
    try {
      loadTomorrow();
      const blocks = getRoutineBlocksByDate(tomorrow)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((b) => ({ id: b.id, startTime: b.startTime, endTime: b.endTime, title: b.title, module: b.module }));
      const result = await suggestTomorrowTweak({
        today: { date: today, mood, blockReviews },
        tomorrow: { date: tomorrow, blocks },
        primaryDomains,
      });
      setTweak(result);
    } catch (e) {
      setTweakError(e instanceof Error ? e.message : 'Could not load suggestion');
    } finally {
      setTweakLoading(false);
    }
  }, [loadTomorrow, tomorrow, today, mood, blockReviews, primaryDomains]);

  const setReview = (blockId: string, value: BlockReview) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setBlockReviews((prev) => ({ ...prev, [blockId]: value }));
  };

  const goToMood = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep('mood');
  };

  const goToTomorrow = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep('tomorrow');
    fetchTweak();
  };

  const applyTweak = () => {
    if (!tweak) return;
    if (tweak.blockId && (tweak.kind === 'move' || tweak.kind === 'resize' || tweak.kind === 'swap')) {
      updateRoutineBlock(tweak.blockId, tweak.patch);
    }
    // "add" is not auto-applied in v1 — user can edit the routine manually
    setTweakAccepted(true);
    loadTomorrow();
  };

  const dismissTweak = () => {
    setTweakAccepted(false);
  };

  const finish = async () => {
    setSaving(true);
    try {
      upsertReflection({
        date: today,
        mood,
        blockReviews,
        tweakAccepted,
        tweakPayload: tweak,
      });
      logBehaviourEvent('reflection_completed', 'goal');
      track('evening_reflect_completed', {
        block_count: blockReviews.length,
        tweak_accepted: tweakAccepted,
      });

      // Onboarding v2: regenerate tomorrow's full routine from the rich profile,
      // softened if the user looks depleted. Failures are non-fatal — the legacy
      // cloneRoutineToDate seed already wrote a usable tomorrow.
      if (onboardingV2 && userId) {
        try {
          const profile = await getUserProfile(userId);
          if (profile) {
            const skippedIds = Object.entries(blockReviews)
              .filter(([, v]) => v === 'skipped')
              .map(([id]) => id);
            const completedIds = Object.entries(blockReviews)
              .filter(([, v]) => v === 'did')
              .map(([id]) => id);
            const titleFor = (id: string) =>
              todayBlocks.find((b) => b.id === id)?.title ?? '';
            const soften = isRecoveryLow({
              lastSleepHours: getLatestSleepHours(3),
              skippedTodayCount: skippedIds.length,
              lastMood: mood,
            });
            // Replace the cloned-from-today seed with a freshly generated plan.
            deleteRoutineBlocksByDate(tomorrow);
            await generateAndSaveTomorrow({
              profile,
              todayReview: {
                mood,
                blockReviews,
                skippedTitles: skippedIds.map(titleFor).filter(Boolean),
                completedTitles: completedIds.map(titleFor).filter(Boolean),
              },
              softenForRecovery: soften,
            });
            track('tomorrow_routine_generated', { soften, skipped: skippedIds.length });
          }
        } catch (err) {
          // Non-fatal: tomorrow still has the cloned seed.
          track('tomorrow_routine_failed', { error: err instanceof Error ? err.message.slice(0, 120) : 'unknown' });
        }
      }

      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  };

  const reviewedCount = Object.keys(blockReviews).length;
  const canAdvanceFromBlocks = reviewedCount > 0 || todayBlocks.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      <AuroraBackground />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
          <Label color={c.primaryLight} style={styles.eyebrow}>EVENING REFLECT</Label>
          <Heading style={styles.title}>
            {step === 'blocks' && 'How did today go?'}
            {step === 'mood' && 'And how did it feel?'}
            {step === 'tomorrow' && 'One tweak for tomorrow'}
          </Heading>
          <Stepper current={step} />
        </Animated.View>

        {step === 'blocks' && (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.list}>
            {todayBlocks.length === 0 ? (
              <Card><Body style={styles.muted}>No blocks to review today. Skip ahead.</Body></Card>
            ) : (
              todayBlocks.map((b) => (
                <Card key={b.id} style={styles.blockCard}>
                  <View style={styles.blockHeader}>
                    <Caption style={{ color: c.textMuted, fontFamily: fonts.heading }}>
                      {b.startTime} – {b.endTime}
                    </Caption>
                    <Body style={{ fontFamily: fonts.heading, fontSize: fontSizes.md }}>{b.title}</Body>
                  </View>
                  <View style={styles.reviewRow}>
                    {REVIEW_OPTIONS.map((opt) => {
                      const selected = blockReviews[b.id] === opt.value;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => setReview(b.id, opt.value)}
                          style={[
                            styles.reviewBtn,
                            { borderColor: selected ? opt.color : c.border, backgroundColor: selected ? opt.color + '1F' : 'transparent' },
                          ]}
                        >
                          <Ionicons name={opt.icon} size={16} color={selected ? opt.color : c.textMuted} />
                          <Caption style={{ color: selected ? opt.color : c.textSecondary, fontFamily: fonts.heading }}>
                            {opt.label}
                          </Caption>
                        </Pressable>
                      );
                    })}
                  </View>
                </Card>
              ))
            )}
            <Button title="Continue" onPress={goToMood} disabled={!canAdvanceFromBlocks} />
          </Animated.View>
        )}

        {step === 'mood' && (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.list}>
            <View style={styles.moodRow}>
              {MOODS.map((m) => {
                const selected = mood === m.v;
                return (
                  <Pressable
                    key={m.v}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.selectionAsync();
                      setMood(m.v);
                    }}
                    style={[
                      styles.moodBtn,
                      selected && { borderColor: c.primary, backgroundColor: c.primary + '22' },
                    ]}
                  >
                    <Body style={styles.moodEmoji}>{m.emoji}</Body>
                    <Caption style={{ color: selected ? c.primaryLight : c.textMuted }}>{m.label}</Caption>
                  </Pressable>
                );
              })}
            </View>
            <Button title="Continue" onPress={goToTomorrow} disabled={mood === null} />
            <Pressable onPress={goToTomorrow} style={styles.skip}>
              <Caption style={{ color: c.textMuted }}>Skip</Caption>
            </Pressable>
          </Animated.View>
        )}

        {step === 'tomorrow' && (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.list}>
            {tweakLoading && (
              <Card><Body style={styles.muted}>Thinking about tomorrow…</Body></Card>
            )}

            {tweakError && (
              <Card><Body style={{ color: c.error }}>{tweakError}</Body></Card>
            )}

            {tweak && !tweakLoading && (
              <Card style={[styles.tweakCard, { borderLeftWidth: 4, borderLeftColor: c.primary }]}>
                <View style={styles.tweakHeader}>
                  <Ionicons name="sparkles" size={18} color={c.primaryLight} />
                  <Label color={c.primaryLight}>SUGGESTED TWEAK</Label>
                </View>
                <Body style={styles.tweakRationale}>{tweak.rationale}</Body>
                <View style={[styles.tweakPatch, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <Caption style={{ color: c.textMuted, fontFamily: fonts.heading, letterSpacing: 0.5 }}>
                    {tweak.kind.toUpperCase()}{tweak.blockId ? '' : ' · NEW BLOCK'}
                  </Caption>
                  <Body style={{ color: c.textPrimary, marginTop: 4 }}>
                    {describePatch(tweak)}
                  </Body>
                </View>

                {tweakAccepted === null && (
                  <View style={styles.tweakActions}>
                    <Button title="Dismiss" variant="secondary" onPress={dismissTweak} style={{ flex: 1 }} />
                    <Button title="Apply" onPress={applyTweak} style={{ flex: 1 }} />
                  </View>
                )}
                {tweakAccepted === true && (
                  <Caption style={{ color: c.success, fontFamily: fonts.heading, marginTop: spacing.sm }}>
                    ✓ Applied to tomorrow
                  </Caption>
                )}
                {tweakAccepted === false && (
                  <Caption style={{ color: c.textMuted, marginTop: spacing.sm }}>
                    Dismissed — keeping tomorrow as-is.
                  </Caption>
                )}
              </Card>
            )}

            {tomorrowBlocks.length > 0 && (
              <>
                <Label color={c.textMuted} style={styles.previewLabel}>TOMORROW'S PLAN</Label>
                <View style={styles.preview}>
                  {tomorrowBlocks.map((b) => {
                    const isTarget = tweak?.blockId === b.id && tweakAccepted === true;
                    return (
                      <View
                        key={b.id}
                        style={[
                          styles.previewRow,
                          { borderColor: isTarget ? c.primary + '77' : c.border },
                          isTarget && { backgroundColor: c.primary + '14' },
                        ]}
                      >
                        <Caption style={{ color: c.textMuted, fontFamily: fonts.heading, width: 52 }}>
                          {b.startTime}
                        </Caption>
                        <Body style={{ flex: 1 }}>{b.title}</Body>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            <Button
              title={saving ? 'Saving…' : tweakAccepted === null ? 'Finish without applying' : 'Finish'}
              onPress={finish}
              disabled={saving}
            />
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stepper({ current }: { current: Step }) {
  const c = useColors();
  const styles = makeStyles(c);
  const order: Step[] = ['blocks', 'mood', 'tomorrow'];
  const idx = order.indexOf(current);
  return (
    <View style={styles.stepper}>
      {order.map((s, i) => (
        <View
          key={s}
          style={[
            styles.stepDot,
            { backgroundColor: i <= idx ? c.primary : c.border },
          ]}
        />
      ))}
    </View>
  );
}

function describePatch(t: TomorrowTweak): string {
  const parts: string[] = [];
  if (t.patch.startTime) parts.push(`starts ${t.patch.startTime}`);
  if (t.patch.endTime) parts.push(`ends ${t.patch.endTime}`);
  if (t.patch.title) parts.push(`"${t.patch.title}"`);
  if (t.patch.module) parts.push(`[${t.patch.module}]`);
  return parts.join(' · ') || 'No changes';
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  header: { gap: spacing.sm, paddingTop: spacing.xl, paddingBottom: spacing.sm },
  eyebrow: { letterSpacing: 1 },
  title: { color: colors.textPrimary },
  stepper: { flexDirection: 'row', gap: 6, marginTop: spacing.sm },
  stepDot: { width: 28, height: 4, borderRadius: 2 },
  list: { gap: spacing.md },
  muted: { color: colors.textMuted },
  blockCard: { gap: spacing.sm },
  blockHeader: { gap: 2 },
  reviewRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  moodBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  moodEmoji: { fontSize: 28 },
  skip: { alignSelf: 'center', padding: spacing.sm },
  tweakCard: { gap: spacing.sm },
  tweakHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  tweakRationale: { color: colors.textPrimary, fontSize: fontSizes.md, lineHeight: 22 },
  tweakPatch: { borderWidth: 1, borderRadius: 12, padding: spacing.sm },
  tweakActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  previewLabel: { letterSpacing: 1, marginTop: spacing.sm },
  preview: { gap: 6 },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: colors.card,
  },
});
