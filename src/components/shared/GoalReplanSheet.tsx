import { View, StyleSheet, Modal, Pressable, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Button } from '@/components/ui/Button';
import { Body, Caption, Heading } from '@/components/ui/Typography';
import type { ReplanRemainingDay } from '@/ai/types';
import { RoutineDiffPreview, type ExistingBlock } from './RoutineDiffPreview';

export type GoalReplanPhase = 'choice' | 'loading' | 'preview' | 'applied' | 'error';

interface Props {
  visible: boolean;
  phase: GoalReplanPhase;
  /** The goal title the change is about, shown in the prompt copy. */
  goalTitle: string;
  /** What the user just did to the goal — drives the copy. */
  action: 'removed' | 'postponed' | 'added';
  /** Plan returned by replanRemainingDay (preview phase only). */
  plan?: ReplanRemainingDay | null;
  /** Remaining blocks today, for matching dropped/edited ids in the preview. */
  existing?: ExistingBlock[];
  onAdjustNow: () => void;
  onSkip: () => void;
  onConfirmPreview?: () => void;
  onCancelPreview?: () => void;
  onUndo?: () => void;
  onClose?: () => void;
  onRetry?: () => void;
  errorMessage?: string;
}

export function GoalReplanSheet({
  visible, phase, goalTitle, action,
  plan = null, existing = [],
  onAdjustNow, onSkip, onConfirmPreview, onCancelPreview, onUndo, onClose, onRetry, errorMessage,
}: Props) {
  const c = useColors();
  const styles = makeStyles(c);

  const verb = action === 'removed' ? 'removed' : action === 'added' ? 'added' : 'postponed';
  const handleNow = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAdjustNow();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />

          {/* PHASE: choice ─────────────────────────────────────────────── */}
          {phase === 'choice' && (
            <>
              <Heading style={styles.title}>Goal {verb}</Heading>
              <Body style={styles.subtitle}>
                {action === 'added'
                  ? `You added "${goalTitle}". Want me to work it into the rest of today?`
                  : `You ${verb} "${goalTitle}". Want me to rebalance the rest of today so its time goes elsewhere?`}
              </Body>
              <View style={styles.actions}>
                <Button title="Adjust my day now" variant="secondary" onPress={handleNow} />
                <Pressable onPress={onSkip} style={styles.skip} hitSlop={8}>
                  <Caption style={{ color: c.textMuted }}>Not now — leave today as is</Caption>
                </Pressable>
              </View>
            </>
          )}

          {/* PHASE: loading ───────────────────────────────────────────── */}
          {phase === 'loading' && (
            <View style={styles.centered}>
              <ActivityIndicator color={c.primary} size="large" />
              <Body style={{ color: c.textSecondary, marginTop: spacing.md }}>
                Re-planning your remaining day…
              </Body>
            </View>
          )}

          {/* PHASE: preview ───────────────────────────────────────────── */}
          {phase === 'preview' && plan && (
            <RoutineDiffPreview
              existing={existing}
              plan={plan}
              onConfirm={() => onConfirmPreview?.()}
              onCancel={() => onCancelPreview?.()}
            />
          )}

          {/* PHASE: error ─────────────────────────────────────────────── */}
          {phase === 'error' && (
            <View style={styles.centered}>
              <Ionicons name="alert-circle" size={36} color={c.error} />
              <Heading style={[styles.title, { marginTop: spacing.sm }]}>Couldn't adjust today</Heading>
              <Body style={{ color: c.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
                {errorMessage ?? 'The plan request failed. Try again or leave today as is.'}
              </Body>
              <View style={[styles.actions, { marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm }]}>
                <Button title="Try again" variant="secondary" onPress={() => onRetry?.()} style={{ flex: 1 }} />
                <Button title="Leave as is" onPress={onSkip} style={{ flex: 1 }} />
              </View>
            </View>
          )}

          {/* PHASE: applied ───────────────────────────────────────────── */}
          {phase === 'applied' && (
            <View style={styles.centered}>
              <Ionicons name="checkmark-circle" size={36} color={c.success} />
              <Heading style={[styles.title, { marginTop: spacing.sm }]}>Day adjusted</Heading>
              <Body style={{ color: c.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
                The rest of today reflects the change. Undo within 24 hours if you change your mind.
              </Body>
              <View style={[styles.actions, { marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm }]}>
                <Button title="Undo" variant="secondary" onPress={() => onUndo?.()} style={{ flex: 1 }} />
                <Button title="Done" onPress={() => onClose?.()} style={{ flex: 1 }} />
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, maxHeight: '90%', gap: spacing.md,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.sm },
  title: { textAlign: 'center', color: c.textPrimary },
  subtitle: { color: c.textSecondary, textAlign: 'center' },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  skip: { alignSelf: 'center', padding: spacing.sm },
  centered: { alignItems: 'center', paddingVertical: spacing.lg },
});
