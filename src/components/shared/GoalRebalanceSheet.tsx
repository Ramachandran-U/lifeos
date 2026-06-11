import { View, StyleSheet, Modal, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Button } from '@/components/ui/Button';
import { Body, Caption, Heading } from '@/components/ui/Typography';

export type GoalRebalancePhase = 'choice' | 'loading' | 'preview' | 'applied' | 'error';

export interface RebalanceSuggestion {
  goalId: string;
  goalTitle: string;
  weeklyHours: number;
  reason: string;
}

interface Props {
  visible: boolean;
  phase: GoalRebalancePhase;
  /** The domain that triggered the nudge, e.g. "career". Shown in the choice copy. */
  starvedDomain?: string;
  suggestions?: RebalanceSuggestion[];
  /** AI's one-sentence framing of the rebalance. */
  insight?: string;
  onCheckNow: () => void;
  onConfirm: () => void;
  onDismiss: () => void;
  onRetry?: () => void;
  errorMessage?: string;
}

export function GoalRebalanceSheet({
  visible, phase, starvedDomain,
  suggestions = [], insight,
  onCheckNow, onConfirm, onDismiss, onRetry, errorMessage,
}: Props) {
  const c = useColors();
  const styles = makeStyles(c);

  const domainLabel = starvedDomain
    ? starvedDomain.charAt(0).toUpperCase() + starvedDomain.slice(1)
    : 'A domain';

  const handleNow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCheckNow();
  };

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />

          {/* PHASE: choice ─────────────────────────────────────────── */}
          {phase === 'choice' && (
            <>
              <View style={styles.iconRow}>
                <View style={[styles.iconBadge, { backgroundColor: c.goalDim }]}>
                  <Ionicons name="git-branch-outline" size={22} color={c.goalText} />
                </View>
              </View>
              <Heading style={styles.title}>Balance check</Heading>
              <Body style={styles.subtitle}>
                {`${domainLabel} has been getting less attention than your other goals this week. Want me to suggest a fresh hour split across your active goals?`}
              </Body>
              <View style={styles.actions}>
                <Button title="Suggest a rebalance" variant="secondary" onPress={handleNow} />
                <Pressable onPress={onDismiss} style={styles.skip} hitSlop={8}>
                  <Caption style={{ color: c.textMuted }}>Dismiss — I'll sort this myself</Caption>
                </Pressable>
              </View>
            </>
          )}

          {/* PHASE: loading ───────────────────────────────────────── */}
          {phase === 'loading' && (
            <View style={styles.centered}>
              <ActivityIndicator color={c.primary} size="large" />
              <Body style={{ color: c.textSecondary, marginTop: spacing.md }}>
                Analysing your goals and time…
              </Body>
            </View>
          )}

          {/* PHASE: preview ───────────────────────────────────────── */}
          {phase === 'preview' && (
            <>
              {insight && (
                <Body style={[styles.insight, { color: c.textSecondary }]}>{insight}</Body>
              )}
              <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                {suggestions.map((s) => (
                  <View key={s.goalId} style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}>
                    <View style={styles.rowLeft}>
                      <Body style={{ color: c.textPrimary, fontFamily: fonts.heading, fontSize: fontSizes.md }}>
                        {s.weeklyHours}h / week
                      </Body>
                      <Caption style={{ color: c.textMuted }} numberOfLines={1}>{s.goalTitle}</Caption>
                    </View>
                    <Caption style={[styles.reason, { color: c.textSecondary }]} numberOfLines={2}>
                      {s.reason}
                    </Caption>
                  </View>
                ))}
              </ScrollView>
              <View style={[styles.actions, { flexDirection: 'row', gap: spacing.sm }]}>
                <Button title="Not now" variant="secondary" onPress={onDismiss} style={{ flex: 1 }} />
                <Button title="Apply targets" onPress={handleConfirm} style={{ flex: 1 }} />
              </View>
            </>
          )}

          {/* PHASE: error ─────────────────────────────────────────── */}
          {phase === 'error' && (
            <View style={styles.centered}>
              <Ionicons name="alert-circle" size={36} color={c.error} />
              <Heading style={[styles.title, { marginTop: spacing.sm }]}>Couldn't check balance</Heading>
              <Body style={{ color: c.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
                {errorMessage ?? 'The request failed. Try again or dismiss.'}
              </Body>
              <View style={[styles.actions, { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }]}>
                <Button title="Try again" variant="secondary" onPress={() => onRetry?.()} style={{ flex: 1 }} />
                <Button title="Dismiss" onPress={onDismiss} style={{ flex: 1 }} />
              </View>
            </View>
          )}

          {/* PHASE: applied ───────────────────────────────────────── */}
          {phase === 'applied' && (
            <View style={styles.centered}>
              <Ionicons name="checkmark-circle" size={36} color={c.success} />
              <Heading style={[styles.title, { marginTop: spacing.sm }]}>Targets saved</Heading>
              <Body style={{ color: c.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
                Your weekly hour targets are updated. The planner will use them when building tomorrow's routine.
              </Body>
              <Button title="Done" onPress={onDismiss} style={{ marginTop: spacing.md }} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: c.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: spacing.xl, maxHeight: '80%', gap: spacing.md,
    },
    handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.sm },
    iconRow: { alignItems: 'center' },
    iconBadge: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    title: { textAlign: 'center', color: c.textPrimary },
    subtitle: { color: c.textSecondary, textAlign: 'center' },
    insight: { textAlign: 'center', fontStyle: 'italic', fontSize: fontSizes.sm },
    actions: { gap: spacing.sm, marginTop: spacing.xs },
    skip: { alignSelf: 'center', padding: spacing.sm },
    centered: { alignItems: 'center', paddingVertical: spacing.lg },
    list: { maxHeight: 300 },
    listContent: { gap: spacing.sm },
    row: {
      flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
      padding: spacing.md, borderRadius: 14, borderWidth: 1,
    },
    rowLeft: { minWidth: 80, gap: 2 },
    reason: { flex: 1, fontSize: fontSizes.sm, lineHeight: 18 },
  });
