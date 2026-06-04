import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Body, Heading, Label, Caption } from '@/components/ui/Typography';
import { useAI } from '@/hooks/useAI';
import { decomposeGoal } from '@/ai/functions';
import { track, EVENTS } from '@/utils/telemetry';
import { useUserStore } from '@/store/useUserStore';
import { useGoalStore } from '@/store/useGoalStore';
import { createGoal } from '@/db/queries/goals';
import { persistHierarchy } from '@/utils/persistHierarchy';
import { addGoalFocusBlocks } from '@/utils/goalRoutine';
import { GOAL_TYPE_LEGEND, useGoalTypeColor } from '@/utils/goalTypeColor';
import type { GoalHierarchy } from '@/ai/types';

interface AddGoalSheetProps {
  visible: boolean;
  onClose: () => void;
}

// How many milestones the user can edit inline. The full plan (12) is still
// saved; this is just the visible, editable slice so the sheet stays light.
const VISIBLE_MILESTONES = 3;

// User-chosen horizons. We never preset a deadline (that reads as pressure) —
// the user tells us how long they're giving themselves, or leaves it open.
const TIMELINES = ['3 months', '6 months', '1 year', '2+ years'] as const;

// Rotating prompts for the empty goal box — span domains so the field reads as
// "any goal, your words", not a single template.
const GOAL_PLACEHOLDERS = [
  'I want to run a marathon',
  'I want to switch into product management',
  'I want to save 6 months of runway',
  'I want to read 24 books this year',
  'I want to get fit and sleep better',
];

export function AddGoalSheet({ visible, onClose }: AddGoalSheetProps) {
  const c = useColors();
  const styles = makeStyles(c);
  const getTypeColor = useGoalTypeColor();
  const { call, error } = useAI();
  const { userId, name } = useUserStore();
  const loadGoals = useGoalStore((s) => s.loadGoals);

  const [goalText, setGoalText] = useState('');
  const [hierarchy, setHierarchy] = useState<GoalHierarchy | null>(null);

  // Editable copies of the AI proposal (item 1 — nothing is read-only now).
  const [draftTitle, setDraftTitle] = useState('');
  const [draftYearly, setDraftYearly] = useState('');
  const [draftMilestones, setDraftMilestones] = useState<string[]>([]);
  const [domainType, setDomainType] = useState<string>('personal');
  const [timeline, setTimeline] = useState<string | null>(null);
  const [addToRoutine, setAddToRoutine] = useState(true);

  // BUG-012: a cold decompose call runs ~15-20s with no feedback. Show a
  // "still working" hint after 8s, and let the user abandon the wait.
  const [slowHint, setSlowHint] = useState(false);
  const [decomposing, setDecomposing] = useState(false);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Breathing shimmer for the skeleton cards while we wait (item 4).
  const pulse = useSharedValue(0.5);
  useEffect(() => {
    if (decomposing) {
      pulse.value = withRepeat(withTiming(1, { duration: 850 }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = 0.5;
    }
  }, [decomposing, pulse]);
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: 0.3 + pulse.value * 0.45 }));

  const clearSlowTimer = () => {
    if (slowTimer.current) { clearTimeout(slowTimer.current); slowTimer.current = null; }
  };

  const resetState = () => {
    setGoalText('');
    setHierarchy(null);
    setDraftTitle('');
    setDraftYearly('');
    setDraftMilestones([]);
    setTimeline(null);
    setAddToRoutine(true);
  };

  const handleDecompose = async () => {
    if (!goalText.trim()) return;
    cancelledRef.current = false;
    abortRef.current = new AbortController();
    setSlowHint(false);
    setDecomposing(true);
    const startedAt = Date.now();
    track(EVENTS.goalDecomposeStarted, {}); // activation funnel — start
    slowTimer.current = setTimeout(() => setSlowHint(true), 8000);
    const result = await call(() => decomposeGoal({ visionStatement: goalText, name }, { signal: abortRef.current?.signal }));
    clearSlowTimer();
    setSlowHint(false);
    setDecomposing(false);
    // If the user tapped Cancel while we were waiting, drop the late result.
    // (the abandon event is fired in handleCancelDecompose.)
    if (cancelledRef.current) return;
    if (result) {
      track(EVENTS.goalDecomposeSucceeded, { duration_ms: Date.now() - startedAt });
      setHierarchy(result);
      setDraftTitle(result.primaryGoal.title);
      setDraftYearly(result.yearly.title);
      setDraftMilestones(result.monthly.slice(0, VISIBLE_MILESTONES).map((m) => m.title));
      setDomainType(result.primaryGoal.type);
    } else {
      // Null result with no cancel = the AI call failed (the ~20s wait that
      // most hurts activation). Track it so the abandon/fail rate is visible.
      track(EVENTS.goalDecomposeAbandoned, { reason: 'failed', duration_ms: Date.now() - startedAt });
    }
  };

  const handleSave = () => {
    if (!hierarchy || !userId) return;

    // Merge the user's edits back into the full hierarchy so persistHierarchy
    // still writes all five levels — we only overwrite the titles they touched.
    // The domain re-tag is passed via opts.goalType (the schema's primaryGoal
    // .type enum doesn't include 'social', so we don't mutate it here).
    const edited: GoalHierarchy = {
      ...hierarchy,
      primaryGoal: { ...hierarchy.primaryGoal, title: draftTitle.trim() || hierarchy.primaryGoal.title },
      yearly: { ...hierarchy.yearly, title: draftYearly.trim() || hierarchy.yearly.title },
      monthly: hierarchy.monthly.map((m, i) =>
        i < draftMilestones.length ? { ...m, title: draftMilestones[i].trim() || m.title } : m,
      ),
    };

    const { lifeId } = persistHierarchy(userId, edited, createGoal, {
      timeline: timeline ?? undefined,
      goalType: domainType,
    });

    // Recurring focus habit (item 3) — best-effort; never block the save.
    if (addToRoutine) {
      try {
        addGoalFocusBlocks({ goalId: lifeId, goalType: domainType, title: edited.primaryGoal.title });
      } catch { /* routine seeding is non-critical */ }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    loadGoals(userId);
    resetState();
    onClose();
  };

  const handleCancelDecompose = () => {
    // Only an in-flight decompose counts as an abandon (handleClose calls this
    // unconditionally on close, even when nothing is running).
    if (decomposing) track(EVENTS.goalDecomposeAbandoned, { reason: 'cancelled' });
    cancelledRef.current = true;
    abortRef.current?.abort(); // truly cancels the in-flight request (BUG-012)
    clearSlowTimer();
    setSlowHint(false);
    setDecomposing(false);
  };

  const handleClose = () => {
    handleCancelDecompose();
    resetState();
    onClose();
  };

  const selectDomain = (gt: string) => {
    Haptics.selectionAsync().catch(() => {});
    setDomainType(gt);
  };

  const selectTimeline = (t: string) => {
    Haptics.selectionAsync().catch(() => {});
    setTimeline((prev) => (prev === t ? null : t));
  };

  const updateMilestone = (idx: number, text: string) => {
    setDraftMilestones((prev) => prev.map((m, i) => (i === idx ? text : m)));
  };

  const accent = getTypeColor(domainType).color;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      // KB-04: without onRequestClose, RN-web's Modal ignores Esc entirely
      // (focus is irrelevant — Esc was a no-op from anywhere). Every other
      // sheet wires this; AddGoalSheet was the lone omission. This is the
      // definitive KB-04 fix.
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <ScrollView
            contentContainerStyle={styles.sheetScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Heading style={styles.title}>Add a goal</Heading>

            <Input
              label="What do you want to achieve?"
              rotatingPlaceholders={GOAL_PLACEHOLDERS}
              value={goalText}
              onChangeText={setGoalText}
              multiline
              numberOfLines={3}
              style={styles.input}
            />

            {!hierarchy && !decomposing && (
              <Button title="Break it down" onPress={handleDecompose} disabled={!goalText.trim()} />
            )}

            {decomposing && (
              <View style={styles.loadingContainer}>
                {/* Skeleton cards that breathe, then morph into the real plan. */}
                {[0, 1, 2].map((i) => (
                  <Animated.View
                    key={i}
                    style={[styles.skeletonCard, { width: `${92 - i * 12}%` }, shimmerStyle]}
                  />
                ))}
                <Body style={styles.loadingText}>
                  {slowHint
                    ? 'Still designing — big goals can take ~20s. Hang tight or cancel.'
                    : 'Designing your plan…'}
                </Body>
                <Button title="Cancel" variant="ghost" onPress={handleCancelDecompose} />
              </View>
            )}

            {error && !decomposing && <Body style={styles.errorText}>{error}</Body>}

            {hierarchy && !decomposing && (
              <View style={styles.preview}>
                {/* GOAL — editable */}
                <Animated.View entering={FadeInDown.duration(280)}>
                  <View style={[styles.editCard, { borderLeftColor: accent, borderColor: c.border }]}>
                    <Label color={accent}>GOAL</Label>
                    <TextInput
                      style={[styles.goalTitleInput, { color: c.textPrimary }]}
                      value={draftTitle}
                      onChangeText={setDraftTitle}
                      placeholder="Goal title"
                      placeholderTextColor={c.textMuted}
                      multiline
                    />
                  </View>
                </Animated.View>

                {/* DOMAIN — which life area this belongs to (item 3) */}
                <Animated.View entering={FadeInDown.delay(60).duration(280)}>
                  <Caption style={styles.fieldLabel}>LIFE AREA</Caption>
                  <View style={styles.chipRow}>
                    {GOAL_TYPE_LEGEND.map((entry) => {
                      const tc = getTypeColor(entry.goalType);
                      const selected = domainType === entry.goalType;
                      return (
                        <Pressable
                          key={entry.goalType}
                          onPress={() => selectDomain(entry.goalType)}
                          style={[
                            styles.chip,
                            { borderColor: selected ? tc.color : c.border, backgroundColor: selected ? tc.light : 'transparent' },
                          ]}
                        >
                          <View style={[styles.chipDot, { backgroundColor: tc.color }]} />
                          <Caption style={{ color: selected ? tc.color : c.textSecondary, fontFamily: selected ? fonts.heading : fonts.body }}>
                            {entry.label}
                          </Caption>
                        </Pressable>
                      );
                    })}
                  </View>
                </Animated.View>

                {/* OUTCOME + MILESTONES — editable, undated (item 2) */}
                <Animated.View entering={FadeInDown.delay(120).duration(280)}>
                  <Caption style={styles.fieldLabel}>WHAT SUCCESS LOOKS LIKE</Caption>
                  <View style={[styles.editCard, { borderLeftColor: accent, borderColor: c.border }]}>
                    <TextInput
                      style={[styles.bodyInput, { color: c.textPrimary }]}
                      value={draftYearly}
                      onChangeText={setDraftYearly}
                      placeholder="The big outcome"
                      placeholderTextColor={c.textMuted}
                      multiline
                    />
                  </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(180).duration(280)}>
                  <Caption style={styles.fieldLabel}>FIRST MILESTONES</Caption>
                  {draftMilestones.map((m, i) => (
                    <View key={i} style={[styles.milestoneCard, { borderColor: c.border }]}>
                      <View style={[styles.stepDot, { backgroundColor: accent }]}>
                        <Caption style={{ color: '#fff', fontFamily: fonts.heading }}>{i + 1}</Caption>
                      </View>
                      <TextInput
                        style={[styles.milestoneInput, { color: c.textPrimary }]}
                        value={m}
                        onChangeText={(t) => updateMilestone(i, t)}
                        placeholder={`Milestone ${i + 1}`}
                        placeholderTextColor={c.textMuted}
                        multiline
                      />
                    </View>
                  ))}
                  {hierarchy.monthly.length > VISIBLE_MILESTONES && (
                    <Caption style={styles.moreNote}>
                      +{hierarchy.monthly.length - VISIBLE_MILESTONES} more steps planned — you can refine them later.
                    </Caption>
                  )}
                </Animated.View>

                {/* TIMELINE — the user sets the horizon, not the AI (item 2) */}
                <Animated.View entering={FadeInDown.delay(240).duration(280)}>
                  <Caption style={styles.fieldLabel}>HOW LONG ARE YOU GIVING YOURSELF?</Caption>
                  <View style={styles.chipRow}>
                    {TIMELINES.map((t) => {
                      const selected = timeline === t;
                      return (
                        <Pressable
                          key={t}
                          onPress={() => selectTimeline(t)}
                          style={[
                            styles.chip,
                            { borderColor: selected ? accent : c.border, backgroundColor: selected ? getTypeColor(domainType).light : 'transparent' },
                          ]}
                        >
                          <Caption style={{ color: selected ? accent : c.textSecondary, fontFamily: selected ? fonts.heading : fonts.body }}>
                            {t}
                          </Caption>
                        </Pressable>
                      );
                    })}
                  </View>
                </Animated.View>

                {/* ADD TO ROUTINE — recurring focus habit (item 3) */}
                <Animated.View entering={FadeInDown.delay(300).duration(280)}>
                  <Pressable
                    style={[styles.toggleRow, { borderColor: addToRoutine ? accent : c.border }]}
                    onPress={() => { Haptics.selectionAsync().catch(() => {}); setAddToRoutine((v) => !v); }}
                  >
                    <Ionicons
                      name={addToRoutine ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={addToRoutine ? accent : c.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Body style={{ color: c.textPrimary, fontFamily: fonts.heading }}>Add a daily focus block</Body>
                      <Caption style={{ color: c.textSecondary }}>
                        Reserves time on your routine and updates your Life Score as you complete it.
                      </Caption>
                    </View>
                  </Pressable>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(360).duration(280)} style={styles.actions}>
                  <Button title="Save goal" onPress={handleSave} />
                  <Button title="Close" variant="ghost" onPress={handleClose} />
                </Animated.View>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    maxHeight: '90%',
  },
  sheetScroll: {
    paddingBottom: spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.md,
  },
  input: {
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  skeletonCard: {
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
  },
  preview: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  fieldLabel: {
    color: colors.textSecondary,
    letterSpacing: 1,
    fontFamily: fonts.heading,
    marginBottom: spacing.xs,
  },
  editCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: spacing.md,
    gap: 4,
  },
  goalTitleInput: {
    fontFamily: 'Nunito-Bold',
    fontSize: 17,
    padding: 0,
    marginTop: 2,
  },
  bodyInput: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    padding: 0,
    lineHeight: fontSizes.md * 1.4,
  },
  milestoneCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  milestoneInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    padding: 0,
    lineHeight: fontSizes.md * 1.4,
  },
  moreNote: {
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
