import { useState } from 'react';
import { ActivityIndicator, View, StyleSheet, Modal, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Body, Caption, Heading, Label } from '@/components/ui/Typography';
import { DOMAIN_META } from '@/constants/gamification';
import type { PriorityChangeImpact } from '@/cognition/priorityChangeHandler';
import type { DomainId } from '@/store/useUserStore';
import type { ReplanRemainingDay } from '@/ai/types';
import { RoutineDiffPreview, type ExistingBlock } from './RoutineDiffPreview';

export type SheetPhase = 'choice' | 'loading' | 'preview' | 'applied' | 'error';

interface Props {
  visible: boolean;
  impact: PriorityChangeImpact;
  phase: SheetPhase;
  /** Plan returned by replanRemainingDay (only used when phase === 'preview'). */
  plan?: ReplanRemainingDay | null;
  /** Existing blocks today for matching dropped/edited ids in the preview. */
  existing?: ExistingBlock[];
  onAdjustNow: () => void;
  onStartTomorrow: () => void;
  onSkip: () => void;
  /** Confirm the proposed diff (preview phase). */
  onConfirmPreview?: () => void;
  /** Cancel the proposed diff and return to the choice phase. */
  onCancelPreview?: () => void;
  /** Undo the just-applied replan (applied phase). */
  onUndo?: () => void;
  /** Close the sheet entirely. */
  onClose?: () => void;
  /** Retry the failed "Adjust now" replan. */
  onRetry?: () => void;
  /** Error message (used when phase === 'error'). */
  errorMessage?: string;
}

function domainLabel(d: DomainId): string {
  return DOMAIN_META.find((m) => m.key === d)?.label ?? d;
}
function domainEmoji(d: DomainId): string {
  return DOMAIN_META.find((m) => m.key === d)?.emoji ?? '●';
}

export function PriorityChangeSheet({
  visible, impact, phase,
  plan = null, existing = [],
  onAdjustNow, onStartTomorrow, onSkip,
  onConfirmPreview, onCancelPreview, onUndo, onClose, onRetry, errorMessage,
}: Props) {
  const c = useColors();
  const styles = makeStyles(c);

  const haptic = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };
  const handleTomorrow = () => { haptic(); onStartTomorrow(); };
  const handleNow = () => { haptic(); onAdjustNow(); };

  const hasGains = impact.gaining.length > 0;
  const hasLosses = impact.losing.length > 0;
  const hasRisks = impact.streaksAtRisk.length > 0 || impact.expeditionsSlowing.length > 0 || impact.goalsOrphaned.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />

          {/* PHASE: choice ─────────────────────────────────────────────── */}
          {phase === 'choice' && (
            <>
              <Heading style={styles.title}>Priorities updated</Heading>

              {(hasGains || hasLosses) && (
                <Card style={styles.impactCard}>
                  <Label color={c.textMuted}>WHAT CHANGES</Label>
                  {impact.gaining.map((d) => (
                    <View key={d} style={styles.row}>
                      <Body style={{ color: c.success }}>+ {domainEmoji(d)} {domainLabel(d)}</Body>
                      <Caption style={{ color: c.textMuted }}>blocks will appear</Caption>
                    </View>
                  ))}
                  {impact.losing.map((d) => (
                    <View key={d} style={styles.row}>
                      <Body style={{ color: c.error }}>− {domainEmoji(d)} {domainLabel(d)}</Body>
                      <Caption style={{ color: c.textMuted }}>{impact.blocksAtRisk.filter((b) => b.module === (d === 'goals' ? 'goal' : d)).length} block(s) removed</Caption>
                    </View>
                  ))}
                </Card>
              )}

              {hasRisks && (
                <Card style={[styles.impactCard, { borderLeftWidth: 3, borderLeftColor: c.warning }]}>
                  <Label color={c.warning}>HEADS UP</Label>
                  {impact.streaksAtRisk.map((s) => (
                    <Body key={s.streakKey} style={styles.risk}>
                      Your {s.count}-day {s.streakKey} streak may lapse
                    </Body>
                  ))}
                  {impact.expeditionsSlowing.map((e) => (
                    <Body key={e.id} style={styles.risk}>
                      "{e.title}" expedition continues but may slow
                    </Body>
                  ))}
                  {impact.goalsOrphaned.map((g) => (
                    <Body key={g.domain} style={styles.risk}>
                      {g.activeGoals} active {domainLabel(g.domain)} goal(s) will continue unscheduled
                    </Body>
                  ))}
                </Card>
              )}

              <View style={styles.actions}>
                {!impact.tooLateForToday && (
                  <Button title="Adjust my day now" variant="secondary" onPress={handleNow} style={styles.btn} />
                )}
                <Button title="Start fresh tomorrow" onPress={handleTomorrow} style={styles.btn} />
                {impact.tooLateForToday && (
                  <Caption style={{ color: c.textMuted, textAlign: 'center' }}>
                    Only {impact.remainingMinutes} min left today — tomorrow is recommended.
                  </Caption>
                )}
              </View>

              <Pressable onPress={onSkip} style={styles.skip} hitSlop={8}>
                <Caption style={{ color: c.textMuted }}>Skip — save the setting only</Caption>
              </Pressable>
            </>
          )}

          {/* PHASE: loading ───────────────────────────────────────────── */}
          {phase === 'loading' && (
            <View style={styles.loadingState}>
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
            <View style={styles.appliedState}>
              <Ionicons name="alert-circle" size={36} color={c.error} />
              <Heading style={[styles.title, { marginTop: spacing.sm }]}>Couldn't adjust today</Heading>
              <Body style={{ color: c.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
                {errorMessage ?? 'The plan request failed. Try again, choose tomorrow instead, or skip and save the setting.'}
              </Body>
              <View style={[styles.actions, { marginTop: spacing.md, flexDirection: 'row', flexWrap: 'wrap' }]}>
                <Button title="Try again" variant="secondary" onPress={() => onRetry?.()} style={{ flex: 1, minWidth: 110 }} />
                <Button title="Start tomorrow" onPress={() => onStartTomorrow?.()} style={{ flex: 1, minWidth: 110 }} />
              </View>
              <Pressable onPress={onSkip} style={styles.skip} hitSlop={8}>
                <Caption style={{ color: c.textMuted }}>Skip — just save the setting</Caption>
              </Pressable>
            </View>
          )}

          {/* PHASE: applied ───────────────────────────────────────────── */}
          {phase === 'applied' && (
            <View style={styles.appliedState}>
              <Ionicons name="checkmark-circle" size={36} color={c.success} />
              <Heading style={[styles.title, { marginTop: spacing.sm }]}>Day adjusted</Heading>
              <Body style={{ color: c.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
                Your remaining day reflects the new priorities. Undo within 24 hours if you change your mind.
              </Body>
              <View style={[styles.actions, { marginTop: spacing.md, flexDirection: 'row' }]}>
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
  impactCard: { gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  risk: { color: c.textSecondary, fontSize: fontSizes.sm },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  btn: {},
  skip: { alignSelf: 'center', padding: spacing.sm },
  loadingState: { alignItems: 'center', paddingVertical: spacing.xxl },
  appliedState: { alignItems: 'center', paddingVertical: spacing.lg },
});
