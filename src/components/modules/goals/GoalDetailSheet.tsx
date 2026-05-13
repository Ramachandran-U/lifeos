import { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Caption, Label } from '@/components/ui/Typography';
import { useGoalTypeColor } from '@/utils/goalTypeColor';
import { addGoalComment, listGoalComments, deleteGoalComment, type GoalComment } from '@/db/queries/goalComments';
import { updateGoalDescription } from '@/db/queries/goals';
import { describeGoal } from '@/ai/functions';

interface Props {
  visible: boolean;
  onClose: () => void;
  goalId: string | null;
  goalTitle: string;
  goalType: string;
  goalLevel?: string;
  initialDescription?: string;
  userId: string;
  onCommentChange?: () => void;
  onDescriptionChange?: () => void;
}

export function GoalDetailSheet({
  visible, onClose, goalId, goalTitle, goalType, goalLevel,
  initialDescription, userId, onCommentChange, onDescriptionChange,
}: Props) {
  const c = useColors();
  const typeColor = useGoalTypeColor()(goalType);
  const [comments, setComments] = useState<GoalComment[]>([]);
  const [draft, setDraft] = useState('');
  const [description, setDescription] = useState<string>(initialDescription ?? '');
  const [descLoading, setDescLoading] = useState(false);
  const [descError, setDescError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && goalId) {
      setComments(listGoalComments(goalId));
      setDescription(initialDescription ?? '');
      setDescError(null);
    }
  }, [visible, goalId, initialDescription]);

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
        <Animated.View entering={FadeInDown.duration(250)} style={[styles.box, { backgroundColor: c.card, borderColor: c.border }]}>
          <Label color={typeColor.color}>{typeColor.label.toUpperCase()}</Label>
          <Body style={[styles.title, { color: c.textPrimary }]}>{goalTitle}</Body>

          <View style={[styles.divider, { backgroundColor: c.border }]} />

          <View style={styles.section}>
            <View style={styles.descHeader}>
              <Caption style={{ color: c.textSecondary, letterSpacing: 1, fontFamily: fonts.heading }}>DESCRIPTION</Caption>
              <Pressable
                onPress={handleGenerateDescription}
                disabled={descLoading}
                style={[styles.descBtn, { backgroundColor: descLoading ? c.surface : typeColor.light }]}
                hitSlop={6}
              >
                <Ionicons
                  name={descLoading ? 'hourglass-outline' : (description ? 'refresh' : 'sparkles')}
                  size={12}
                  color={typeColor.color}
                />
                <Caption style={{ color: typeColor.color, fontFamily: fonts.heading }}>
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
                  <Pressable onPress={() => remove(cm.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={16} color={c.error} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary }]}
              placeholder="Add a comment…"
              placeholderTextColor={c.textMuted}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={submit}
              returnKeyType="send"
              multiline
            />
            <Pressable
              style={[styles.sendBtn, { backgroundColor: draft.trim() ? typeColor.color : c.surface }]}
              onPress={submit}
              disabled={!draft.trim()}
            >
              <Ionicons name="send" size={16} color={draft.trim() ? '#fff' : c.textMuted} />
            </Pressable>
          </View>

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Caption style={{ color: c.textSecondary }}>Close</Caption>
          </Pressable>
        </Animated.View>
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
  descHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  descBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8,
  },
});
