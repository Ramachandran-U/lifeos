import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Body, Caption, Label } from '@/components/ui/Typography';
import { isEnabled } from '@/config/flags';
import { detectOvercommitment } from '@/cognition/overcommitment';
import {
  recordInsight,
  updateInsightStatus,
  isInsightCooldownOk,
} from '@/db/queries/cognitiveInsights';
import { getRoutineBlocksByDate, getRoutineBlocksInRange } from '@/db/queries/routine';
import { getEventsLastNDays } from '@/db/queries/behaviour';
import { getLatestSleepHours } from '@/db/queries/health';
import { getUser } from '@/db/queries/users';
import { track, EVENTS } from '@/utils/telemetry';

interface Props {
  userId: string;
  /** Date being assessed (typically tomorrow when shown in evening-reflect). */
  date: string;
}

function blockMinutes(b: { startTime: string; endTime: string }): number {
  const [sh, sm] = b.startTime.split(':').map((s) => parseInt(s, 10));
  const [eh, em] = b.endTime.split(':').map((s) => parseInt(s, 10));
  return (eh * 60 + em) - (sh * 60 + sm);
}

function computeAchievableBaseline(today: Date): number {
  // Rolling 14-day median of completed/in-progress block minutes per day.
  const start = new Date(today.getTime() - 14 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const blocks = getRoutineBlocksInRange(fmt(start), fmt(today));
  const byDate: Record<string, number> = {};
  for (const b of blocks) {
    if (b.status !== 'completed' && b.status !== 'in_progress') continue;
    byDate[b.date] = (byDate[b.date] ?? 0) + blockMinutes(b);
  }
  const totals = Object.values(byDate).sort((a, b) => a - b);
  if (totals.length === 0) return 0;
  const mid = Math.floor(totals.length / 2);
  return totals.length % 2 ? totals[mid]! : Math.round((totals[mid - 1]! + totals[mid]!) / 2);
}

function computeRecentSkipRate(): number {
  const events = getEventsLastNDays(5);
  if (events.length === 0) return 0;
  const completed = events.filter((e) => e.eventType === 'block_completed').length;
  const skipped = events.filter((e) => e.eventType === 'block_skipped').length;
  const denom = completed + skipped;
  return denom === 0 ? 0 : skipped / denom;
}

export function OvercommitmentCard({ userId, date }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const [insight, setInsight] = useState<{
    id: string;
    severity: number;
    reasons: string[];
    plannedMinutes: number;
    baselineMinutes: number;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isEnabled('overcommitmentDetector')) return;
    const run = () => {
      const candidate = detectOvercommitment(date, {
        plannedMinutesForDate: (d) => {
          const blocks = getRoutineBlocksByDate(d);
          return blocks.reduce((acc, b) => acc + blockMinutes(b), 0);
        },
        highEnergyBlocksFor: (d) => getRoutineBlocksByDate(d).filter((b) => b.energyRequired === 'high').length,
        achievableBaseline: () => computeAchievableBaseline(new Date()),
        lastSleepHours: () => getLatestSleepHours(3),
        sleepTargetHours: () => {
          const u = getUser();
          return (u as { sleepTargetHours?: number | null } | undefined)?.sleepTargetHours ?? null;
        },
        recentSkipRate: computeRecentSkipRate,
        recentMood: () => null,
        // Cross-domain insight — uses 'goals' as the sentinel domain field for
        // cooldown bookkeeping (overcommitment is not domain-scoped). 24h cooldown.
        cooldownOk: () => isInsightCooldownOk(userId, 'overcommitment', 'goals', 1),
      });
      if (!candidate || candidate.severity < 30) return; // below threshold = silent

      const insightId = recordInsight({
        userId,
        kind: 'overcommitment',
        domain: 'goals', // sentinel for cooldown lookup
        evidence: {
          delta: Math.round((candidate.loadRatio - 1) * 100),
          daysFlat: 0,
          currentScore: candidate.severity,
        },
        suggestions: [],
        ttlDays: 1,
      });
      setInsight({
        id: insightId,
        severity: candidate.severity,
        reasons: candidate.reasons,
        plannedMinutes: candidate.plannedMinutes,
        baselineMinutes: candidate.baselineMinutes,
      });
      track(EVENTS.overcommitmentShown, { severity: candidate.severity, reasonCount: candidate.reasons.length });
    };
    try { run(); } catch { /* non-fatal — never break the host screen */ }
  }, [userId, date]);

  const handleOpenPlan = useCallback(() => {
    if (!insight) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateInsightStatus(insight.id, 'accepted');
    track(EVENTS.overcommitmentAccepted, { severity: insight.severity });
    router.push('/edit-routine');
  }, [insight, router]);

  const handleDismiss = useCallback(() => {
    if (!insight) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    updateInsightStatus(insight.id, 'dismissed');
    setDismissed(true);
    track(EVENTS.overcommitmentDismissed, { severity: insight.severity });
  }, [insight]);

  if (!insight || dismissed || !isEnabled('overcommitmentVisible')) return null;

  const accent = insight.severity >= 70 ? c.error : c.warning;
  const headline = insight.severity >= 70 ? 'Tomorrow looks heavy' : 'Plan trending heavy';

  return (
    // Neutral card — the severity ink lives in the eyebrow (R2: semantic is data).
    <Card style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="speedometer-outline" size={18} color={accent} />
        <Label color={accent}>HEADS UP</Label>
      </View>
      <Body style={styles.headline}>{headline}</Body>
      <Body style={styles.body}>
        Planned <Body style={{ fontFamily: fonts.heading }}>{insight.plannedMinutes} min</Body> vs. your usual{' '}
        <Body style={{ fontFamily: fonts.heading }}>{insight.baselineMinutes} min</Body>.
      </Body>
      <View style={styles.reasons}>
        {insight.reasons.map((r, i) => (
          <View key={i} style={styles.reasonRow}>
            <Ionicons name="alert-circle-outline" size={14} color={c.textMuted} />
            <Caption style={{ color: c.textSecondary, flex: 1 }}>{r}</Caption>
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        <Button title="Not now" variant="secondary" onPress={handleDismiss} style={{ flex: 1 }} />
        <Button title="Open my plan" variant="primary" onPress={handleOpenPlan} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  card: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headline: { color: c.textPrimary, fontSize: fontSizes.md, fontFamily: fonts.heading },
  body: { color: c.textSecondary, fontSize: fontSizes.sm, lineHeight: 22 },
  reasons: { gap: 6 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
});
