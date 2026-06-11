import { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Heading, Caption, Label } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { InkCanvas } from '@/components/shared/InkCanvas';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import { getExpedition, getExpeditionProgress, saveExpeditionProgress } from '@/db/queries/expeditions';
import { completeStep, progressFraction } from '@/explore/expeditions';
import { XP_VALUES } from '@/utils/gamification';
import { track, EVENTS } from '@/utils/telemetry';

const KIND_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  read: 'book-outline',
  watch: 'play-circle-outline',
  do: 'hammer-outline',
  reflect: 'leaf-outline',
};

export default function ExpeditionDetailScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserStore((s) => s.userId);
  const { addXP, awardBadge } = useGameStore();
  const [version, setVersion] = useState(0);

  const expedition = useMemo(() => (id ? getExpedition(id) : undefined), [id]);
  const progress = useMemo(
    () => (userId && id ? getExpeditionProgress(userId, id) : undefined),
    [userId, id, version],
  );

  const handleComplete = useCallback((stepIndex: number) => {
    if (!expedition || !progress || !userId) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updated = completeStep(progress, stepIndex, expedition.totalSteps, {
      now: () => new Date().toISOString(),
      newId: () => '',
    });
    saveExpeditionProgress(updated);
    setVersion((v) => v + 1);
    addXP(userId, XP_VALUES.completeGoalTask);
    track(EVENTS.expeditionStepCompleted, { expeditionId: id, step: stepIndex });
    if (updated.status === 'completed') {
      awardBadge(userId, 'polymath_starter');
      track(EVENTS.expeditionCompleted, { expeditionId: id });
    }
  }, [expedition, progress, userId, id, addXP, awardBadge]);

  if (!expedition || !progress) {
    return (
      <SafeAreaView style={styles.container}>
        <InkCanvas />
        <Body style={[styles.empty, { color: c.textMuted }]}>Expedition not found.</Body>
        <Button title="Back" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const frac = progressFraction(progress, expedition.totalSteps);
  const completedSet = new Set(progress.completedSteps);

  return (
    <SafeAreaView style={styles.container}>
      <InkCanvas />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={c.textSecondary} />
          <Caption style={{ color: c.textSecondary }}>Explore</Caption>
        </Pressable>

        <View style={styles.header}>
          <Label color={c.polymath} style={{ letterSpacing: 1 }}>EXPEDITION</Label>
          <Heading style={{ color: c.textPrimary }}>{expedition.title}</Heading>
          <View style={styles.progressRow}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.round(frac * 100)}%`, backgroundColor: c.polymath }]} />
            </View>
            <Caption style={{ color: c.textMuted, fontFamily: fonts.heading }}>
              {progress.completedSteps.length}/{expedition.totalSteps}
            </Caption>
          </View>
          {progress.status === 'completed' && (
            <Caption style={{ color: c.success, fontFamily: fonts.heading }}>Completed!</Caption>
          )}
        </View>

        <View style={styles.steps}>
          {expedition.steps.map((step, i) => {
            const done = completedSet.has(step.index);
            const isNext = step.index === progress.currentStep && !done;
            const locked = step.index > progress.currentStep && !done;
            return (
              <Animated.View key={step.index} entering={FadeInDown.delay(i * 60).duration(300)}>
                <Card style={[styles.stepCard, isNext && { borderColor: c.polymath, borderWidth: 1 }]}>
                  <View style={styles.stepHeader}>
                    <View style={[styles.stepNum, { backgroundColor: done ? c.success : isNext ? c.polymath : c.border }]}>
                      {done
                        ? <Ionicons name="checkmark" size={14} color="#FFF" />
                        : <Caption style={{ color: '#FFF', fontFamily: fonts.heading }}>{step.index + 1}</Caption>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Body style={{ fontFamily: fonts.heading, color: locked ? c.textMuted : c.textPrimary }}>{step.title}</Body>
                      <Caption style={{ color: c.textMuted }}>
                        <Ionicons name={KIND_ICON[step.kind] ?? 'ellipse-outline'} size={12} color={c.textMuted} /> {step.kind} · {step.estMinutes} min
                      </Caption>
                    </View>
                  </View>
                  {(isNext || done) && (
                    <Body style={{ color: c.textSecondary, marginTop: spacing.xs }}>{step.prompt}</Body>
                  )}
                  {isNext && !done && (
                    <Button title="Mark complete" onPress={() => handleComplete(step.index)} style={{ marginTop: spacing.sm }} />
                  )}
                </Card>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: spacing.md },
  header: { gap: spacing.xs, paddingTop: spacing.sm },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  progressBar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.border, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  steps: { gap: spacing.sm },
  stepCard: { gap: spacing.xs },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', paddingTop: spacing.xxl },
});
