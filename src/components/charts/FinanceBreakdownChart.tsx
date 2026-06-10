import { useEffect, useSyncExternalStore } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { isEnabled } from '@/config/flags';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { CHART_HEIGHT } from './chartTheme';
import {
  beginChartsLoad,
  getChartsImpl,
  getChartsLoadState,
  subscribeChartsLoad,
} from './lazyCharts';

export interface BreakdownSlice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  slices: BreakdownSlice[];
  /** Formats legend amounts, e.g. (v) => `₹${v.toLocaleString()}`. */
  formatValue: (v: number) => string;
}

/**
 * Spend-by-category breakdown (M4, flag: animatedCharts). Skia donut on
 * native; everywhere else a proportional-bar legend (which also renders
 * UNDER the donut as the shared legend, so labels never live inside the
 * canvas and need no Skia font).
 */
export function FinanceBreakdownChart({ slices, formatValue }: Props) {
  const c = useColors();
  const flagOn = isEnabled('animatedCharts');
  const loadState = useSyncExternalStore(subscribeChartsLoad, getChartsLoadState, getChartsLoadState);

  useEffect(() => {
    if (flagOn) beginChartsLoad();
  }, [flagOn]);

  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const impl = flagOn && loadState === 'ready' ? getChartsImpl() : null;
  const Breakdown = impl?.BreakdownImpl;

  return (
    <View style={styles.wrap}>
      {Breakdown && slices.length > 0 && (
        <Breakdown slices={slices} height={CHART_HEIGHT.breakdown} />
      )}
      <View style={styles.legend}>
        {slices.map((s) => {
          const pct = total > 0 ? s.value / total : 0;
          return (
            <View key={s.label} style={styles.row}>
              <View style={[styles.swatch, { backgroundColor: s.color }]} />
              <Text style={[styles.label, { color: c.textPrimary }]} numberOfLines={1}>
                {s.label}
              </Text>
              <Text style={[styles.amount, { color: c.textSecondary }]}>
                {formatValue(s.value)}
              </Text>
              <View style={[styles.track, { backgroundColor: c.border }]}>
                <View
                  style={[
                    styles.fill,
                    { backgroundColor: s.color, width: `${Math.round(pct * 100)}%` },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  legend: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  swatch: { width: 10, height: 10, borderRadius: radii.hairline },
  label: { fontFamily: fonts.body, fontSize: fontSizes.sm, flexShrink: 1, maxWidth: '40%' },
  amount: { fontFamily: fonts.heading, fontSize: fontSizes.sm, marginLeft: 'auto' },
  track: {
    flexBasis: '100%',
    height: 4,
    borderRadius: radii.hairline,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radii.hairline },
});
