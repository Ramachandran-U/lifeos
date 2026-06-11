/**
 * The cross-module Life Score hero (P4-01).
 *
 * Composite of all six domain scores with a 30/90-day trend chip and a
 * 90-day mini-sparkline. Renders nothing while history is empty so a
 * fresh install doesn't show an unmoving "—".
 */

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Polyline, Line } from 'react-native-svg';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Card } from '@/components/ui/Card';
import { Body, Caption, Heading, Label } from '@/components/ui/Typography';
import { useGameStore } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { useDomainHistoryStore } from '@/store/useDomainHistoryStore';
import { computeLifeScore, computeLifeScoreTrend, lifeScoreBand } from '@/utils/lifeScore';

const SPARK_WIDTH = 220;
const SPARK_HEIGHT = 48;

interface Props {
  /** Hide the sparkline when there isn't enough history yet (default 5 points). */
  minHistoryPoints?: number;
}

function fmtDelta(d: number): string {
  if (d === 0) return '±0';
  return d > 0 ? `+${d}` : `${d}`;
}

export function LifeScoreHero({ minHistoryPoints = 5 }: Props) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const domainScores = useGameStore((s) => s.domainScores);
  const primaryDomains = useUserStore((s) => s.primaryDomains);
  const entries = useDomainHistoryStore((s) => s.entries);

  const trend = useMemo(
    () => computeLifeScoreTrend(domainScores, entries, primaryDomains),
    [domainScores, entries, primaryDomains],
  );

  // First render after install: no per-domain history yet, so just compute
  // the static value with no trend chips.
  const haveTrend = trend.history.length >= minHistoryPoints;
  const score = trend.current || computeLifeScore(domainScores, primaryDomains);
  const band = lifeScoreBand(score);

  const sparklinePoints = useMemo(() => {
    if (!haveTrend) return '';
    const hist = trend.history;
    const min = Math.min(...hist);
    const max = Math.max(...hist);
    const range = max - min || 1;
    const stepX = SPARK_WIDTH / Math.max(1, hist.length - 1);
    return hist
      .map((v, i) => {
        const x = i * stepX;
        const y = SPARK_HEIGHT - ((v - min) / range) * SPARK_HEIGHT;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [trend.history, haveTrend]);

  const deltaTone = (d: number) =>
    d > 0 ? c.success : d < 0 ? c.warning : c.textMuted;

  return (
    // Neutral card — cross-domain score; trend deltas carry the semantic ink.
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Label>LIFE SCORE</Label>
          <View style={styles.scoreRow}>
            <Heading style={[styles.score, { color: c.textPrimary }]}>{score}</Heading>
            <Caption style={{ color: c.textMuted, marginLeft: spacing.xs }}>/100</Caption>
          </View>
          <Caption style={{ color: c.textSecondary, marginTop: 2 }}>{band.label}</Caption>
        </View>
        {haveTrend ? (
          <View style={styles.deltaCol}>
            <View style={styles.deltaRow}>
              <Caption style={{ color: c.textMuted, marginRight: spacing.xs }}>30d</Caption>
              <Body style={{ color: deltaTone(trend.delta30), fontFamily: fonts.heading }}>
                {fmtDelta(trend.delta30)}
              </Body>
            </View>
            <View style={styles.deltaRow}>
              <Caption style={{ color: c.textMuted, marginRight: spacing.xs }}>90d</Caption>
              <Body style={{ color: deltaTone(trend.delta90), fontFamily: fonts.heading }}>
                {fmtDelta(trend.delta90)}
              </Body>
            </View>
          </View>
        ) : null}
      </View>

      {haveTrend ? (
        <View style={styles.sparkRow}>
          <Svg width={SPARK_WIDTH} height={SPARK_HEIGHT}>
            <Line x1={0} y1={SPARK_HEIGHT - 1} x2={SPARK_WIDTH} y2={SPARK_HEIGHT - 1} stroke={c.border} strokeWidth={1} />
            <Polyline
              points={sparklinePoints}
              fill="none"
              stroke={c.primary}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </Svg>
        </View>
      ) : null}

      <Caption style={{ color: c.textMuted, marginTop: spacing.xs }}>{band.description}</Caption>
    </Card>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  card: { gap: spacing.xs },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.xs },
  score: { fontFamily: fonts.display, fontSize: fontSizes.hero },
  deltaCol: { alignItems: 'flex-end', gap: 4 },
  deltaRow: { flexDirection: 'row', alignItems: 'center' },
  sparkRow: { marginTop: spacing.xs, alignItems: 'center' },
});
