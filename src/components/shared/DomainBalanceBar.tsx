import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Card } from '@/components/ui/Card';
import { Body, Caption, Label } from '@/components/ui/Typography';
import {
  DOMAIN_LABEL,
  DOMAIN_ORDER,
  DOMAIN_COLOR_KEY,
  type DomainKey,
} from '@/utils/routineBalance';

interface Props {
  /** Minutes per life-domain (e.g. from aggregatePlannedDomainMinutes). */
  minutes: Record<DomainKey, number>;
  title?: string;
  subtitle?: string;
  emptyHint?: string;
}

function fmtMin(m: number): string {
  if (m === 0) return '0';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

/**
 * Presentational horizontal stacked bar + legend for life-domain minutes.
 * Reused by the routine editor's "Today's balance" card; deliberately has no
 * week-over-week deltas (that's WeeklyBalanceCard's job).
 */
export function DomainBalanceBar({
  minutes,
  title = "TODAY'S BALANCE",
  subtitle = 'Planned time · life domains',
  emptyHint = 'Add some domain blocks to see the balance of your day.',
}: Props) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const total = DOMAIN_ORDER.reduce((sum, d) => sum + minutes[d], 0);
  const empty = total === 0;
  const denom = Math.max(1, total);

  return (
    // Neutral card — cross-domain summary; the six hues live in the bar segments.
    <Card style={styles.card}>
      <View style={styles.header}>
        <View>
          <Label>{title}</Label>
          <Caption style={{ color: c.textMuted }}>{subtitle}</Caption>
        </View>
        <Body style={[styles.total, { color: c.textPrimary }]}>{fmtMin(total)}</Body>
      </View>

      {empty ? (
        <Caption style={{ color: c.textMuted, marginTop: spacing.sm }}>{emptyHint}</Caption>
      ) : (
        <>
          <View style={[styles.bar, { backgroundColor: c.border }]}>
            {DOMAIN_ORDER.map((d) => {
              const mins = minutes[d];
              if (mins === 0) return null;
              const pct = (mins / denom) * 100;
              const color = (c as Record<string, string>)[DOMAIN_COLOR_KEY[d]];
              return <View key={d} style={{ width: `${pct}%`, backgroundColor: color, height: '100%' }} />;
            })}
          </View>

          <View style={styles.legend}>
            {DOMAIN_ORDER.map((d) => {
              const mins = minutes[d];
              if (mins === 0) return null;
              const color = (c as Record<string, string>)[DOMAIN_COLOR_KEY[d]];
              return (
                <View key={d} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: color }]} />
                  <Body style={{ color: c.textPrimary, flex: 1 }}>{DOMAIN_LABEL[d]}</Body>
                  <Caption style={{ color: c.textSecondary }}>{fmtMin(mins)}</Caption>
                </View>
              );
            })}
          </View>
        </>
      )}
    </Card>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  card: { gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  total: { fontFamily: fonts.heading, fontSize: fontSizes.xl },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: spacing.xs },
  legend: { gap: spacing.xs, marginTop: spacing.sm },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});
