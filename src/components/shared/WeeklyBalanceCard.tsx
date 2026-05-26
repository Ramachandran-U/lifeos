import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Card } from '@/components/ui/Card';
import { Body, Caption, Label } from '@/components/ui/Typography';
import {
  buildBalanceSummary,
  DOMAIN_LABEL,
  DOMAIN_ORDER,
  DOMAIN_COLOR_KEY,
  type DomainKey,
} from '@/utils/routineBalance';

interface Props {
  primaryDomains?: string[];
  onRebalanceTomorrow?: (silentDomain: DomainKey) => void;
}

function fmtMin(m: number): string {
  if (m === 0) return '0';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

function deltaLabel(delta: number): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (delta === 0) return { text: 'flat', tone: 'flat' };
  const abs = Math.abs(delta);
  const sign = delta > 0 ? '+' : '-';
  return { text: `${sign}${fmtMin(abs)}`, tone: delta > 0 ? 'up' : 'down' };
}

export function WeeklyBalanceCard({ primaryDomains = [], onRebalanceTomorrow }: Props) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const summary = useMemo(() => buildBalanceSummary(primaryDomains), [primaryDomains]);

  const empty = summary.totalCurrent === 0;
  const total = Math.max(1, summary.totalCurrent); // avoid divide-by-zero

  const rebalanceTarget = summary.silentPrimary[0];

  return (
    <Card moduleColor={c.primary} style={styles.card}>
      <View style={styles.header}>
        <View>
          <Label color={c.primary}>WEEKLY BALANCE</Label>
          <Caption style={{ color: c.textMuted }}>Time spent · last 7 days</Caption>
        </View>
        <Body style={[styles.total, { color: c.textPrimary }]}>{fmtMin(summary.totalCurrent)}</Body>
      </View>

      {empty ? (
        <Caption style={{ color: c.textMuted, marginTop: spacing.sm }}>
          Complete a few blocks to see where your week went.
        </Caption>
      ) : (
        <>
          <View style={[styles.bar, { backgroundColor: c.border }]}>
            {DOMAIN_ORDER.map((d) => {
              const mins = summary.current[d];
              if (mins === 0) return null;
              const pct = (mins / total) * 100;
              const colorKey = DOMAIN_COLOR_KEY[d];
              return (
                <View
                  key={d}
                  style={{ width: `${pct}%`, backgroundColor: (c as Record<string, string>)[colorKey], height: '100%' }}
                />
              );
            })}
          </View>

          <View style={styles.legend}>
            {DOMAIN_ORDER.map((d) => {
              const mins = summary.current[d];
              if (mins === 0 && summary.deltas[d] === 0) return null;
              const colorKey = DOMAIN_COLOR_KEY[d];
              const dot = (c as Record<string, string>)[colorKey];
              const delta = deltaLabel(summary.deltas[d]);
              const toneColor =
                delta.tone === 'up' ? c.success : delta.tone === 'down' ? c.warning : c.textMuted;
              return (
                <View key={d} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: dot }]} />
                  <Body style={{ color: c.textPrimary, flex: 1 }}>{DOMAIN_LABEL[d]}</Body>
                  <Caption style={{ color: c.textSecondary, marginRight: spacing.sm }}>{fmtMin(mins)}</Caption>
                  <Caption style={{ color: toneColor }}>{delta.text}</Caption>
                </View>
              );
            })}
          </View>

          {rebalanceTarget && onRebalanceTomorrow ? (
            <Pressable
              onPress={() => onRebalanceTomorrow(rebalanceTarget)}
              style={({ pressed }) => [
                styles.pill,
                {
                  backgroundColor: pressed ? c.card : c.surface,
                  borderColor: c.border,
                },
              ]}
            >
              <Ionicons name="sync" size={14} color={c.primary} />
              <Body style={{ color: c.textPrimary, flex: 1 }} numberOfLines={1}>
                {DOMAIN_LABEL[rebalanceTarget]} went silent. Bring it back tomorrow?
              </Body>
              <Ionicons name="chevron-forward" size={14} color={c.textMuted} />
            </Pressable>
          ) : null}
        </>
      )}
    </Card>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  total: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
  },
  bar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  legend: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pill: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
  },
});
