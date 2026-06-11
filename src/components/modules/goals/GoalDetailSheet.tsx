import { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, addWeeks, addMonths, differenceInDays, parseISO } from 'date-fns';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Caption, Label } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { useGoalTypeColor } from '@/utils/goalTypeColor';
import { addGoalComment, listGoalComments, deleteGoalComment, type GoalComment } from '@/db/queries/goalComments';
import { updateGoalDescription, updateGoalFields, getChildGoals } from '@/db/queries/goals';
import { GOAL_TYPE_LEGEND } from '@/utils/goalTypeColor';
import { describeGoal } from '@/ai/functions';
import { recoverGoal, type GoalSlipRecovery } from '@/ai/goalRebalance';

interface Props {
  visible: boolean;
  onClose: () => void;
  goalId: string | null;
  goalTitle: string;
  goalType: string;
  goalLevel?: string;
  initialDescription?: string;
  userId: string;
  /** Goal status — drives which lifecycle actions show (active → Postpone/Remove, paused → Resume). */
  goalStatus?: string;
  /** YYYY-MM-DD the goal is snoozed until (when paused via Postpone). */
  snoozeUntil?: string | null;
  onCommentChange?: () => void;
  onDescriptionChange?: () => void;
  /** Called after title/type/timeline are saved so the parent can reload the goal list. */
  onFieldsChanged?: (fields: { title: string; goalType: string; timeline: string | null }) => void;
  /** Soft-delete this goal (recoverable). Parent closes the sheet + offers a re-plan. */
  onRemove?: () => void;
  /** Postpone this goal until `untilDate` (YYYY-MM-DD). */
  onPostpone?: (untilDate: string) => void;
  /** Resume a postponed goal now. */
  onResume?: () => void;
  /** ISO timestamp of the goal's last update — used to detect staleness. */
  goalUpdatedAt?: string;
}

const SNOOZE_PRESETS: { label: string; until: () => string }[] = [
  { label: '1 week', until: () => format(addWeeks(new Date(), 1), 'yyyy-MM-dd') },
  { label: '1 month', until: () => format(addMonths(new Date(), 1), 'yyyy-MM-dd') },
  { label: '3 months', until: () => format(addMonths(new Date(), 3), 'yyyy-MM-dd') },
];

type LifecycleMode = 'view' | 'edit' | 'postpone' | 'confirmRemove';

export function GoalDetailSheet({
  visible, onClose, goalId, goalTitle, goalType, goalLevel,
  initialDescription, userId, goalStatus, snoozeUntil,
  onCommentChange, onDescriptionChange, onRemove, onPostpone, onResume,
  goalUpdatedAt, onFieldsChanged,
}: Props) {
  const c = useColors();
  const typeColor = useGoalTypeColor()(goalType);
  const [comments, setComments] = useState<GoalComment[]>([]);
  const [draft, setDraft] = useState('');
  const [description, setDescription] = useState<string>(initialDescription ?? '');
  const [descLoading, setDescLoading] = useState(false);
  const [descError, setDescError] = useState<string | null>(null);
  const [mode, setMode] = useState<LifecycleMode>('view');
  const [recoveryPlan, setRecoveryPlan] = useState<GoalSlipRecovery | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editGoalType, setEditGoalType] = useState('');
  const [editTimeline, setEditTimeline] = useState('');

  useEffect(() => {
    if (visible && goalId) {
      setComments(listGoalComments(goalId));
      setDescription(initialDescription ?? '');
      setDescError(null);
      setMode('view');
      setRecoveryPlan(null);
      setRecoveryError(null);
      setShowRecovery(false);
      setEditTitle(goalTitle);
      setEditGoalType(goalType);
      setEditTimeline('');
    }
  }, [visible, goalId, initialDescription, goalTitle, goalType]);

  const handleSaveFields = () => {
    if (!goalId || !editTitle.trim()) return;
    const fields = {
      title: editTitle.trim(),
      goalType: editGoalType,
      timeline: editTimeline.trim() || null,
    };
    updateGoalFields(goalId, fields);
    onFieldsChanged?.(fields);
    setMode('view');
  };

  const daysSinceUpdate = goalUpdatedAt
    ? differenceInDays(new Date(), parseISO(goalUpdatedAt))
    : 0;
  const isStalled = goalStatus === 'active' && daysSinceUpdate > 7;

  const handleGetBackOnTrack = async () => {
    if (!goalId) return;
    setShowRecovery(true);
    setRecoveryLoading(true);
    setRecoveryError(null);
    setRecoveryPlan(null);
    try {
      const children = getChildGoals(goalId);
      const lastDone = children.find((c) => c.status === 'completed');
      const nextUp = children.find((c) => c.status === 'active');
      const plan = await recoverGoal({
        goalTitle,
        goalType,
        daysMissed: daysSinceUpdate,
        lastCompletedTask: lastDone?.title ?? 'No recent tasks',
        upcomingMilestone: nextUp?.title ?? 'No upcoming milestone set',
      });
      if (!plan) { setRecoveryError('Couldn\'t generate a plan. Try again.'); return; }
      setRecoveryPlan(plan);
    } catch {
      setRecoveryError('Something went wrong. Try again.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleGenerateDescription = async () => {
    if (!goalId) return;
    setDescLoading(true);
    setDescError(null);
    try {
      const result = await describeGoal({ title: goalTitle, goalType, level: goalLevel });
      updateGoalDescription(goalId, result.description);
      setDescription(result.description);
      onDescriptionChange?.();
    } catch (err) {
      setDescError(err instanceof Error ? err.message : 'Failed to generate description');
    } finally {
      setDescLoading(false);
    }
  };

  if (!goalId) return null;

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    addGoalComment({ goalId, userId, body });
    setDraft('');
    setComments(listGoalComments(goalId));
    onCommentChange?.();
  };

  const remove = (id: string) => {
    deleteGoalComment(id);
    setComments(listGoalComments(goalId));
    onCommentChange?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Label color={typeColor.text}>{typeColor.label.toUpperCase()}</Label>
          <Body style={[styles.title, { color: c.textPrimary }]}>{goalTitle}</Body>

          <View style={[styles.divider, { backgroundColor: c.border }]} />

          <View style={styles.section}>
            <View style={styles.descHeader}>
              <Caption style={{ color: c.textSecondary, letterSpacing: 1, fontFamily: fonts.heading }}>DESCRIPTION</Caption>
              <Pressable
                onPress={handleGenerateDescription}
                disabled={descLoading}
                style={[styles.descBtn, { backgroundColor: descLoading ? c.surface : typeColor.dim }]}
                hitSlop={6}
              >
                <Ionicons
                  name={descLoading ? 'hourglass-outline' : (description ? 'refresh' : 'sparkles')}
                  size={12}
                  color={typeColor.text}
                />
                <Caption style={{ color: typeColor.text, fontFamily: fonts.heading }}>
                  {descLoading ? 'Generating…' : description ? 'Regenerate' : 'Generate'}
                </Caption>
              </Pressable>
            </View>
            {description ? (
              <Body style={{ color: c.textPrimary, lineHeight: fontSizes.md * 1.6 }}>{description}</Body>
            ) : (
              <Caption style={{ color: c.textSecondary }}>No description yet. Generate one to anchor this goal.</Caption>
            )}
            {descError && <Caption style={{ color: c.error }}>{descError}</Caption>}
          </View>

          <View style={[styles.divider, { backgroundColor: c.border }]} />

          <View style={styles.section}>
            <Caption style={{ color: c.textSecondary, letterSpacing: 1, fontFamily: fonts.heading }}>COMMENTS ({comments.length})</Caption>
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {comments.length === 0 && (
                <Caption style={{ color: c.textMuted }}>No comments yet. Add the first note below.</Caption>
              )}
              {comments.map((cm) => (
                <View key={cm.id} style={[styles.commentRow, { borderColor: c.border }]}>
                  <View style={styles.commentBody}>
                    <Caption style={{ color: c.textMuted }}>{new Date(cm.createdAt).toLocaleString()}</Caption>
                    <Body style={{ color: c.textPrimary }}>{cm.body}</Body>
                  </View>
                  <Pressable onPress={() => remove(cm.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete comment">
                    <Ionicons name="trash-outline" size={16} color={c.error} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { backgroundColor: c.background, borderColor: c.border, color: c.textPrimary }]}
              placeholder="Add a comment…"
              placeholderTextColor={c.textMuted}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={submit}
              returnKeyType="send"
              multiline
            />
            <Pressable
              style={[styles.sendBtn, { backgroundColor: draft.trim() ? typeColor.hue : c.surface }]}
              onPress={submit}
              disabled={!draft.trim()}
              accessibilityRole="button"
              accessibilityLabel="Send comment"
            >
              <Ionicons name="send" size={16} color={draft.trim() ? c.inkOnColor : c.textMuted} />
            </Pressable>
          </View>

          {isStalled && !showRecovery && (
            <>
              <View style={[styles.divider, { backgroundColor: c.border }]} />
              <Pressable
                onPress={handleGetBackOnTrack}
                style={[styles.recoveryBanner, { backgroundColor: typeColor.dim, borderColor: c.border }]}
              >
                <Ionicons name="rocket-outline" size={16} color={typeColor.text} />
                <View style={{ flex: 1 }}>
                  <Caption style={{ color: typeColor.text, fontFamily: fonts.heading }}>
                    {`${daysSinceUpdate}d since last update`}
                  </Caption>
                  <Caption style={{ color: c.textSecondary }}>Get a 7-day recovery plan</Caption>
                </View>
                <Ionicons name="chevron-forward" size={14} color={typeColor.text} />
              </Pressable>
            </>
          )}

          {showRecovery && (
            <>
              <View style={[styles.divider, { backgroundColor: c.border }]} />
              <View style={styles.section}>
                <View style={styles.descHeader}>
                  <Caption style={{ color: c.textSecondary, letterSpacing: 1, fontFamily: fonts.heading }}>
                    RECOVERY PLAN
                  </Caption>
                  <Pressable onPress={() => setShowRecovery(false)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close recovery plan">
                    <Ionicons name="close" size={16} color={c.textMuted} />
                  </Pressable>
                </View>
                {recoveryLoading && (
                  <View style={styles.recoveryLoading}>
                    <ActivityIndicator size="small" color={typeColor.text} />
                    <Caption style={{ color: c.textSecondary }}>Building your plan…</Caption>
                  </View>
                )}
                {recoveryError && (
                  <Caption style={{ color: c.error }}>{recoveryError}</Caption>
                )}
                {recoveryPlan && (
                  <>
                    <Body style={{ color: c.textSecondary, fontStyle: 'italic' }}>{recoveryPlan.encouragement}</Body>
                    <View style={[styles.quickWin, { backgroundColor: typeColor.dim, borderColor: c.border }]}>
                      <Ionicons name="flash" size={14} color={typeColor.text} />
                      <Caption style={{ color: typeColor.text, flex: 1 }}>
                        <Caption style={{ fontFamily: fonts.heading }}>Quick win: </Caption>
                        {recoveryPlan.quickWin}
                      </Caption>
                    </View>
                    {recoveryPlan.recoveryPlan.map((step) => (
                      <View key={step.day} style={[styles.recoveryStep, { borderColor: c.border }]}>
                        <View style={[styles.dayBadge, { backgroundColor: typeColor.dim }]}>
                          <Caption style={{ color: typeColor.text, fontFamily: fonts.heading }}>{`D${step.day}`}</Caption>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Caption style={{ color: c.textPrimary }}>{step.task}</Caption>
                          <Caption style={{ color: c.textMuted }}>{step.duration}</Caption>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </View>
            </>
          )}

          {(onRemove || onPostpone || onResume) && (
            <>
              <View style={[styles.divider, { backgroundColor: c.border }]} />
              {goalStatus === 'paused' ? (
                <View style={styles.lifecycleSection}>
                  <Caption style={{ color: c.textSecondary }}>
                    {snoozeUntil ? `Postponed until ${snoozeUntil}` : 'Postponed'}
                  </Caption>
                  <View style={styles.lifecycleRow}>
                    {onResume && (
                      <Button title="Resume now" variant="secondary" onPress={() => onResume()} style={styles.lifecycleBtn} />
                    )}
                    {onRemove && (
                      <Button title="Remove" variant="secondary" onPress={() => setMode('confirmRemove')} style={styles.lifecycleBtn} />
                    )}
                  </View>
                </View>
              ) : mode === 'postpone' ? (
                <View style={styles.lifecycleSection}>
                  <Caption style={{ color: c.textSecondary }}>Postpone until…</Caption>
                  <View style={styles.chipRow}>
                    {SNOOZE_PRESETS.map((p) => (
                      <Pressable
                        key={p.label}
                        style={[styles.chip, { borderColor: c.border }]}
                        onPress={() => onPostpone?.(p.until())}
                      >
                        <Caption style={{ color: typeColor.text, fontFamily: fonts.heading }}>{p.label}</Caption>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable style={styles.linkBtn} onPress={() => setMode('view')} hitSlop={6}>
                    <Caption style={{ color: c.textMuted }}>Cancel</Caption>
                  </Pressable>
                </View>
              ) : mode === 'confirmRemove' ? (
                <View style={styles.lifecycleSection}>
                  <Caption style={{ color: c.textSecondary }}>
                    Remove this goal? You can restore it later from "Recently deleted".
                  </Caption>
                  <View style={styles.lifecycleRow}>
                    {onRemove && (
                      <Button title="Remove" onPress={() => onRemove()} style={StyleSheet.flatten([styles.lifecycleBtn, { backgroundColor: c.error }])} />
                    )}
                    <Button title="Cancel" variant="secondary" onPress={() => setMode('view')} style={styles.lifecycleBtn} />
                  </View>
                </View>
              ) : mode === 'edit' ? (
                <View style={styles.lifecycleSection}>
                  <Caption style={{ color: c.textSecondary, letterSpacing: 1, fontFamily: fonts.heading }}>
                    EDIT GOAL
                  </Caption>
                  <TextInput
                    style={[styles.editInput, { backgroundColor: c.background, borderColor: c.border, color: c.textPrimary }]}
                    value={editTitle}
                    onChangeText={setEditTitle}
                    placeholder="Goal title"
                    placeholderTextColor={c.textMuted}
                    returnKeyType="next"
                  />
                  <Caption style={{ color: c.textSecondary }}>Type</Caption>
                  <View style={styles.chipRow}>
                    {GOAL_TYPE_LEGEND.map((entry) => {
                      const isSelected = editGoalType === entry.goalType;
                      return (
                        <Pressable
                          key={entry.goalType}
                          onPress={() => setEditGoalType(entry.goalType)}
                          style={[
                            styles.chip,
                            // Selected state is data — the border carries the solid hue.
                            { borderColor: isSelected ? typeColor.hue : c.border,
                              backgroundColor: isSelected ? typeColor.dim : 'transparent' },
                          ]}
                        >
                          <Caption style={{ color: isSelected ? typeColor.text : c.textSecondary, fontFamily: isSelected ? fonts.heading : fonts.body }}>
                            {entry.label}
                          </Caption>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Caption style={{ color: c.textSecondary }}>Timeline (optional)</Caption>
                  <TextInput
                    style={[styles.editInput, { backgroundColor: c.background, borderColor: c.border, color: c.textPrimary }]}
                    value={editTimeline}
                    onChangeText={setEditTimeline}
                    placeholder="e.g. By end of Q3 2026"
                    placeholderTextColor={c.textMuted}
                    returnKeyType="done"
                    onSubmitEditing={handleSaveFields}
                  />
                  <View style={styles.lifecycleRow}>
                    <Button
                      title="Save"
                      onPress={handleSaveFields}
                      style={styles.lifecycleBtn}
                    />
                    <Button title="Cancel" variant="secondary" onPress={() => setMode('view')} style={styles.lifecycleBtn} />
                  </View>
                </View>
              ) : (
                <View style={styles.lifecycleRow}>
                  {(goalStatus === 'active' || !goalStatus) && (
                    <Button title="Edit" variant="secondary" onPress={() => setMode('edit')} style={styles.lifecycleBtn} />
                  )}
                  {(goalStatus === 'active' || !goalStatus) && onPostpone && (
                    <Button title="Postpone" variant="secondary" onPress={() => setMode('postpone')} style={styles.lifecycleBtn} />
                  )}
                  {onRemove && (
                    <Button title="Remove" variant="secondary" onPress={() => setMode('confirmRemove')} style={styles.lifecycleBtn} />
                  )}
                </View>
              )}
            </>
          )}

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Caption style={{ color: c.textSecondary }}>Close</Caption>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.72)', padding: spacing.xl },
  box: { width: '100%', maxWidth: 480, borderRadius: 20, borderWidth: 1, padding: spacing.xl, gap: spacing.lg, maxHeight: '85%' },
  title: { fontFamily: fonts.heading, fontSize: fontSizes.xl, lineHeight: fontSizes.xl * 1.3 },
  section: { gap: spacing.sm, flexShrink: 1 },
  list: { maxHeight: 260 },
  listContent: { gap: spacing.sm, paddingVertical: spacing.xs },
  commentRow: { flexDirection: 'row', gap: spacing.sm, borderWidth: 1, borderRadius: 12, padding: spacing.sm, alignItems: 'flex-start' },
  commentBody: { flex: 1, gap: 2 },
  inputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  input: {
    flex: 1, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontFamily: fonts.body, fontSize: fontSizes.md, minHeight: 44, maxHeight: 120,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  closeBtn: { alignSelf: 'center', paddingVertical: spacing.xs },
  divider: { height: 1, borderRadius: 1 },
  lifecycleSection: { gap: spacing.sm },
  lifecycleRow: { flexDirection: 'row', gap: spacing.sm },
  lifecycleBtn: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: 999, borderWidth: 1,
  },
  linkBtn: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  descHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  descBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8,
  },
  editInput: {
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontFamily: fonts.body, fontSize: fontSizes.md, minHeight: 44,
  },
  recoveryBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, borderRadius: 12, borderWidth: 1,
  },
  recoveryLoading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  quickWin: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs,
    padding: spacing.sm, borderRadius: 10, borderWidth: 1,
  },
  recoveryStep: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1,
  },
  dayBadge: {
    width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
});
