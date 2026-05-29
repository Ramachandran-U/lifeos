import { useState } from 'react';
import { View, StyleSheet, Modal, Pressable, Platform } from 'react-native';
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

interface Props {
  visible: boolean;
  impact: PriorityChangeImpact;
  onAdjustNow: () => void;
  onStartTomorrow: () => void;
  onSkip: () => void;
}

function domainLabel(d: DomainId): string {
  return DOMAIN_META.find((m) => m.key === d)?.label ?? d;
}
function domainEmoji(d: DomainId): string {
  return DOMAIN_META.find((m) => m.key === d)?.emoji ?? '●';
}

export function PriorityChangeSheet({ visible, impact, onAdjustNow, onStartTomorrow, onSkip }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const [choice, setChoice] = useState<'now' | 'tomorrow' | null>(null);

  const haptic = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  const handleTomorrow = () => {
    haptic();
    setChoice('tomorrow');
    onStartTomorrow();
  };
  const handleNow = () => {
    haptic();
    setChoice('now');
    onAdjustNow();
  };

  const hasGains = impact.gaining.length > 0;
  const hasLosses = impact.losing.length > 0;
  const hasRisks = impact.streaksAtRisk.length > 0 || impact.expeditionsSlowing.length > 0 || impact.goalsOrphaned.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
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

          {choice === null && (
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
          )}

          {choice === 'tomorrow' && (
            <View style={styles.confirmRow}>
              <Ionicons name="checkmark-circle" size={20} color={c.success} />
              <Body style={{ color: c.success, fontFamily: fonts.heading }}>
                Tomorrow's plan will reflect your new priorities.
              </Body>
            </View>
          )}

          {choice === 'now' && (
            <View style={styles.confirmRow}>
              <Ionicons name="checkmark-circle" size={20} color={c.success} />
              <Body style={{ color: c.success, fontFamily: fonts.heading }}>
                Adjusting today's remaining blocks...
              </Body>
            </View>
          )}

          <Pressable onPress={onSkip} style={styles.skip} hitSlop={8}>
            <Caption style={{ color: c.textMuted }}>Skip — save the setting only</Caption>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, maxHeight: '80%', gap: spacing.md,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.sm },
  title: { textAlign: 'center', color: c.textPrimary },
  impactCard: { gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  risk: { color: c.textSecondary, fontSize: fontSizes.sm },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  btn: {},
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  skip: { alignSelf: 'center', padding: spacing.sm },
});
