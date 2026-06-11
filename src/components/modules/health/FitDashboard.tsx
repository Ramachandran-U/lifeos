import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Body, Caption, Label } from '@/components/ui/Typography';
import { StatTile } from '@/components/modules/health/StatTile';
import { Sparkline } from '@/components/ui/Sparkline';
import type { DailyFitPoint, WorkoutSession } from '@/integrations/googleFit/client';
import { computeFitInsights, weekOverWeekPct } from '@/utils/fitInsights';

const STEP_GOAL = 8000;
const DAY_MS = 24 * 60 * 60 * 1000;

interface FitDashboardProps {
  days: DailyFitPoint[];
  workouts: WorkoutSession[];
}

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtDistance(m: number): string {
  if (m <= 0) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function FitDashboard({ days, workouts }: FitDashboardProps) {
  const c = useColors();
  const styles = makeStyles(c);
  if (days.length === 0) {
    return (
      <Card>
        <Caption style={{ color: c.textMuted }}>No Google Fit data yet. Hit Sync to pull the last 14 days.</Caption>
      </Card>
    );
  }

  const today = days[days.length - 1];
  const last7 = days.slice(-7);
  const avg = (pick: (d: DailyFitPoint) => number) => {
    const vals = last7.map(pick).filter((n) => n > 0);
    return vals.length === 0 ? 0 : vals.reduce((s, n) => s + n, 0) / vals.length;
  };

  // Detect "stale data" state: today is 0 AND last 7 days are all 0, but the
  // wider window has activity. Common when Fit pairing drops mid-window or
  // the user stops carrying their phone/watch. Without this hint the hero
  // reads as "broken" rather than "no recent activity".
  const stepsLast7Total = last7.reduce((s, d) => s + d.steps, 0);
  const stepsAllTotal = days.reduce((s, d) => s + d.steps, 0);
  const lastActiveDay = [...days].reverse().find((d) => d.steps > 0);
  const daysSinceActive = lastActiveDay
    ? Math.floor((Date.parse(today.date) - Date.parse(lastActiveDay.date)) / DAY_MS)
    : null;
  const noRecentActivity = today.steps === 0 && stepsLast7Total === 0 && stepsAllTotal > 0;

  const stepsSeries = last7.map((d) => d.steps);
  const activeSeries = last7.map((d) => d.activeMinutes);
  const heartPointSeries = last7.map((d) => d.heartPoints);
  const caloriesSeries = last7.map((d) => d.caloriesBurned);

  // When the current week is entirely empty, a "↓100%" trend is misleading
  // (reads as "broken" rather than "no data"). Suppress all per-tile trend
  // arrows in that case — the stale-data hint in the hero already explains it.
  const stepsPct = noRecentActivity ? null : weekOverWeekPct(days, (d) => d.steps);
  const activePct = noRecentActivity ? null : weekOverWeekPct(days, (d) => d.activeMinutes);
  const caloriesPct = noRecentActivity ? null : weekOverWeekPct(days, (d) => d.caloriesBurned);
  const hrPct = noRecentActivity ? null : weekOverWeekPct(days, (d) => d.avgHeartRate ?? 0);

  const goalPct = Math.min(100, Math.round((today.steps / STEP_GOAL) * 100));
  const hitDays = last7.filter((d) => d.steps >= STEP_GOAL).length;

  const insights = computeFitInsights(days);

  const sleepDays = days.filter((d) => d.sleep.total > 0).slice(-7);
  const avgSleep = sleepDays.length > 0
    ? sleepDays.reduce((s, d) => s + d.sleep.total, 0) / sleepDays.length
    : 0;
  const avgDeep = sleepDays.length > 0
    ? sleepDays.reduce((s, d) => s + d.sleep.deep, 0) / sleepDays.length
    : 0;
  const avgRem = sleepDays.length > 0
    ? sleepDays.reduce((s, d) => s + d.sleep.rem, 0) / sleepDays.length
    : 0;
  const avgLight = sleepDays.length > 0
    ? sleepDays.reduce((s, d) => s + d.sleep.light, 0) / sleepDays.length
    : 0;
  const sleepTotalForPct = Math.max(1, avgDeep + avgRem + avgLight);

  const latestSpo2 = [...days].reverse().find((d) => d.spo2 !== null)?.spo2 ?? null;
  const latestBodyFat = [...days].reverse().find((d) => d.bodyFatPct !== null)?.bodyFatPct ?? null;
  const latestBp = [...days].reverse().find((d) => d.systolic !== null);

  return (
    <View style={styles.wrap}>
      {/* Hero: today's step progress + stale-data hint when relevant. */}
      <Card style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Label style={{ color: c.textMuted }}>TODAY</Label>
            <View style={styles.heroValue}>
              <Body style={styles.heroSteps}>{today.steps.toLocaleString()}</Body>
              <Caption style={{ color: c.textMuted }}>/ {STEP_GOAL.toLocaleString()} steps</Caption>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${goalPct}%`, backgroundColor: c.health }]} />
            </View>
            {noRecentActivity ? (
              <Caption style={{ color: c.warning, marginTop: 4 }}>
                {daysSinceActive != null && daysSinceActive > 0
                  ? `No activity logged for ${daysSinceActive} day${daysSinceActive === 1 ? '' : 's'} · ${stepsAllTotal.toLocaleString()} steps over 14d`
                  : `No recent activity · ${stepsAllTotal.toLocaleString()} steps over 14d`}
              </Caption>
            ) : (
              <Caption style={{ color: c.textSecondary }}>
                {goalPct}% of goal · {hitDays}/7 days hit this week
              </Caption>
            )}
          </View>
        </View>
      </Card>

      {/* Tier 1 stat grid */}
      <View style={styles.grid}>
        <StatTile
          iconName="footsteps"
          label="STEPS (avg)"
          value={Math.round(avg((d) => d.steps)).toLocaleString()}
          color={c.health}
          trendPct={stepsPct}
          series={stepsSeries}
          target={STEP_GOAL}
        />
        <StatTile
          iconName="timer"
          label="ACTIVE MIN"
          value={Math.round(avg((d) => d.activeMinutes)).toString()}
          unit="min/day"
          color={c.health}
          trendPct={activePct}
          series={activeSeries}
        />
        <StatTile
          iconName="heart"
          label="HEART POINTS"
          value={Math.round(avg((d) => d.heartPoints)).toString()}
          unit="/day"
          color={c.error}
          series={heartPointSeries}
        />
        <StatTile
          iconName="flame"
          label="CALORIES BURNED"
          value={Math.round(avg((d) => d.caloriesBurned)).toLocaleString()}
          unit="kcal/day"
          color={c.warning}
          trendPct={caloriesPct}
          series={caloriesSeries}
        />
        <StatTile
          iconName="navigate"
          label="DISTANCE"
          value={fmtDistance(avg((d) => d.distanceMeters))}
          unit="/day"
          color={c.polymath}
        />
        <StatTile
          iconName="pulse"
          label="AVG HR"
          value={today.avgHeartRate ? Math.round(today.avgHeartRate).toString() : '—'}
          unit="bpm"
          color={c.error}
          trendPct={hrPct === null ? null : -hrPct /* invert: lower HR = improvement */}
        />
      </View>

      {/* Sleep breakdown */}
      {sleepDays.length > 0 && (
        <Card style={styles.block}>
          <View style={styles.blockHeader}>
            <Ionicons name="moon" size={16} color={c.polymath} />
            <Label>SLEEP · last 7 days</Label>
          </View>
          <View style={styles.sleepRow}>
            <View style={{ flex: 1 }}>
              <Body style={styles.sleepTotal}>{(avgSleep / 60).toFixed(1)}h</Body>
              <Caption style={{ color: c.textMuted }}>avg per night</Caption>
            </View>
            <View style={styles.stageCol}>
              {/* Violet is banned from domain content (§A.4) — deep sleep reads in career blue. */}
              <StageBar label="Deep" minutes={avgDeep} totalMinutes={sleepTotalForPct} color={c.career} />
              <StageBar label="REM" minutes={avgRem} totalMinutes={sleepTotalForPct} color={c.polymath} />
              <StageBar label="Light" minutes={avgLight} totalMinutes={sleepTotalForPct} color={c.health} />
            </View>
          </View>
          <Sparkline values={sleepDays.map((d) => d.sleep.total)} color={c.polymath} height={26} />
        </Card>
      )}

      {/* Tier 2 vitals grid */}
      {(latestSpo2 !== null || latestBodyFat !== null || latestBp) && (
        <View style={styles.grid}>
          {latestSpo2 !== null && (
            <StatTile
              iconName="water"
              label="SpO2"
              value={`${Math.round(latestSpo2 * 100) / 100}`}
              unit="%"
              color={c.polymath}
            />
          )}
          {latestBodyFat !== null && (
            <StatTile
              iconName="body"
              label="BODY FAT"
              value={`${Math.round(latestBodyFat * 10) / 10}`}
              unit="%"
              color={c.warning}
            />
          )}
          {latestBp && latestBp.systolic !== null && latestBp.diastolic !== null && (
            <StatTile
              iconName="heart-circle"
              label="BLOOD PRESSURE"
              value={`${Math.round(latestBp.systolic)}/${Math.round(latestBp.diastolic)}`}
              unit="mmHg"
              color={c.error}
            />
          )}
        </View>
      )}

      {/* Workouts */}
      {workouts.length > 0 && (
        <Card style={styles.block}>
          <View style={styles.blockHeader}>
            <Ionicons name="barbell" size={16} color={c.career} />
            <Label>WORKOUTS · {workouts.length}</Label>
          </View>
          {workouts.slice(0, 6).map((w) => (
            <View key={w.id} style={styles.workoutRow}>
              <Ionicons name={w.iconName} size={18} color={c.health} />
              <View style={{ flex: 1 }}>
                <Body style={{ color: c.textPrimary, fontFamily: fonts.heading, fontSize: fontSizes.md }}>{w.name}</Body>
                <Caption style={{ color: c.textMuted }}>{w.date}</Caption>
              </View>
              <Caption style={{ color: c.textSecondary }}>{fmtDuration(w.durationMinutes)}</Caption>
            </View>
          ))}
        </Card>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <View style={styles.insightStack}>
          {insights.map((ins) => (
            <Card key={ins.id} style={{
              ...styles.insightCard,
              borderLeftColor: ins.tone === 'good' ? c.success : ins.tone === 'warn' ? c.warning : c.textMuted,
            }}>
              <Body style={{ color: c.textPrimary, fontFamily: fonts.heading, fontSize: fontSizes.md }}>{ins.headline}</Body>
              <Caption style={{ color: c.textSecondary }}>{ins.detail}</Caption>
            </Card>
          ))}
        </View>
      )}
    </View>
  );
}

function StageBar({ label, minutes, totalMinutes, color }: { label: string; minutes: number; totalMinutes: number; color: string }) {
  const c = useColors();
  const styles = makeStyles(c);
  const pct = Math.round((minutes / totalMinutes) * 100);
  return (
    <View style={styles.stageRow}>
      <Caption style={styles.stageLabel}>{label}</Caption>
      <View style={styles.stageTrack}>
        <View style={[styles.stageFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Caption style={styles.stagePct}>{pct}%</Caption>
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  wrap: { gap: spacing.md },
  heroCard: { paddingVertical: spacing.md },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroValue: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginTop: 4 },
  heroSteps: { fontFamily: fonts.heading, fontSize: fontSizes.xxxl, color: colors.textPrimary },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, marginTop: spacing.sm, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  block: { gap: spacing.sm },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sleepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sleepTotal: { fontFamily: fonts.heading, fontSize: fontSizes.xxl, color: colors.textPrimary },
  stageCol: { flex: 2, gap: 4 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stageLabel: { width: 42, color: colors.textMuted, fontSize: 11 },
  stageTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  stageFill: { height: '100%', borderRadius: 3 },
  stagePct: { width: 36, textAlign: 'right', color: colors.textSecondary, fontSize: 11 },
  workoutRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  insightStack: { gap: spacing.sm },
  insightCard: { borderLeftWidth: 4, gap: 4 },
});
