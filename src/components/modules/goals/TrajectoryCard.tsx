import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Card } from '@/components/ui/Card';
import { Body, Caption, Label } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { assessTrajectory } from '@/ai/functions';
import { useTrajectoryStore } from '@/store/useTrajectoryStore';
import {
  computeTrajectory,
  quarterKey,
  type TrajectoryGoal,
  type TrajectoryStatus,
} from '@/utils/trajectory';
import type { TrajectoryAssessment } from '@/ai/types';

interface Props {
  lifeGoal: TrajectoryGoal;
  goals: TrajectoryGoal[];
}

const STATUS_META: Record<
  Exclude<TrajectoryStatus, 'no_data'>,
  { label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  ahead: { label: 'Ahead of pace', icon: 'rocket-outline' },
  on_track: { label: 'On track', icon: 'navigate-outline' },
  behind: { label: 'Behind pace', icon: 'alert-circle-outline' },
};

export function TrajectoryCard({ lifeGoal, goals }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const needsReview = useTrajectoryStore((s) => s.needsReview());
  const markReviewed = useTrajectoryStore((s) => s.markReviewed);

  const t = useMemo(() => computeTrajectory(lifeGoal, goals), [lifeGoal, goals]);

  const [assessment, setAssessment] = useState<TrajectoryAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nothing meaningful to say until the vision has a sub-goal tree.
  if (t.status === 'no_data') return null;

  const statusColor =
    t.status === 'behind' ? c.warning : t.status === 'ahead' ? c.success : c.primary;
  const meta = STATUS_META[t.status];

  const handleReview = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    Haptics.selectionAsync();
    try {
      const result = await assessTrajectory({
        visionTitle: lifeGoal.title,
        horizonMonths: t.horizonMonths,
        elapsedMonths: t.elapsedMonths,
        expectedProgressPct: Math.round(t.expectedProgress * 100),
        actualProgressPct: Math.round(t.actualProgress * 100),
        status: t.status as 'ahead' | 'on_track' | 'behind',
        completedSubGoals: t.completedSubGoals,
        totalSubGoals: t.totalSubGoals,
        laggingTitles: t.laggingTitles,
      });
      setAssessment(result);
      markReviewed(quarterKey());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assess trajectory.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card moduleColor={statusColor} style={styles.card}>
      <View style={styles.header}>
        <Ionicons name={meta.icon} size={16} color={statusColor} />
        <Label color={statusColor}>TRAJECTORY · {t.horizonMonths}-MONTH VISION</Label>
        {needsReview && !assessment && (
          <View style={[styles.pill, { backgroundColor: statusColor + '22', borderColor: statusColor + '55' }]}>
            <Caption style={{ color: statusColor }}>{quarterKey()} check-in</Caption>
          </View>
        )}
      </View>

      <Body style={[styles.headline, { color: c.textPrimary }]} numberOfLines={2}>
        {lifeGoal.title}
      </Body>

      {/* Expected vs actual progress comparison */}
      <View style={styles.barWrap}>
        <View style={styles.barRow}>
          <Caption style={{ color: c.textMuted, width: 64 }}>Expected</Caption>
          <View style={[styles.track, { backgroundColor: c.surface }]}>
            <View style={[styles.fill, { width: `${Math.round(t.expectedProgress * 100)}%`, backgroundColor: c.textMuted }]} />
          </View>
          <Caption style={{ color: c.textMuted, width: 36, textAlign: 'right' }}>{Math.round(t.expectedProgress * 100)}%</Caption>
        </View>
        <View style={styles.barRow}>
          <Caption style={{ color: c.textSecondary, width: 64 }}>Actual</Caption>
          <View style={[styles.track, { backgroundColor: c.surface }]}>
            <View style={[styles.fill, { width: `${Math.round(t.actualProgress * 100)}%`, backgroundColor: statusColor }]} />
          </View>
          <Caption style={{ color: statusColor, width: 36, textAlign: 'right' }}>{Math.round(t.actualProgress * 100)}%</Caption>
        </View>
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.pill, { backgroundColor: statusColor + '22', borderColor: statusColor + '55' }]}>
          <Caption style={{ color: statusColor, fontFamily: fonts.heading }}>{meta.label}</Caption>
        </View>
        <Caption style={{ color: c.textMuted }}>
          {t.completedSubGoals}/{t.totalSubGoals} milestones · month {t.elapsedMonths} of {t.horizonMonths}
        </Caption>
      </View>

      {assessment ? (
        <View style={styles.assessment}>
          <Body style={{ color: c.textSecondary }}>{assessment.verdict}</Body>
          {assessment.recalibration.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <Ionicons name="arrow-forward-circle-outline" size={16} color={statusColor} />
              <Body style={[styles.stepText, { color: c.textPrimary }]}>{step}</Body>
            </View>
          ))}
        </View>
      ) : (
        <Pressable
          onPress={handleReview}
          disabled={loading}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: pressed ? statusColor + 'cc' : statusColor,
              opacity: loading ? 0.7 : 1,
            },
          ]}
        >
          {loading ? (
            <LoadingDots />
          ) : (
            <Body style={{ color: '#FFFFFF', fontFamily: fonts.heading }}>
              {needsReview ? 'Recalibrate this quarter' : 'Review trajectory'}
            </Body>
          )}
        </Pressable>
      )}

      {error && <Caption style={{ color: c.error }}>{error}</Caption>}
    </Card>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  card: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pill: {
    marginLeft: 'auto',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  headline: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    marginTop: spacing.xs,
  },
  barWrap: { gap: spacing.xs, marginTop: spacing.xs },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  assessment: { gap: spacing.xs, marginTop: spacing.sm },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  stepText: { flex: 1 },
  btn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: spacing.sm,
  },
});
