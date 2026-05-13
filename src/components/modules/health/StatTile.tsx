import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Caption, Label } from '@/components/ui/Typography';
import { Sparkline } from '@/components/ui/Sparkline';

interface StatTileProps {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  unit?: string;
  color: string;
  /** Percentage change vs prior period; null for insufficient data. */
  trendPct?: number | null;
  /** Optional sparkline data. */
  series?: number[];
  target?: number;
}

export function StatTile({
  iconName,
  label,
  value,
  unit,
  color,
  trendPct,
  series,
  target,
}: StatTileProps) {
  const c = useColors();
  const styles = makeStyles(c);
  const hasTrend = trendPct !== null && trendPct !== undefined && Number.isFinite(trendPct);
  const up = (trendPct ?? 0) >= 0;
  return (
    <View style={styles.tile}>
      <View style={styles.row}>
        <Ionicons name={iconName} size={16} color={color} />
        <Label style={styles.label}>{label}</Label>
      </View>
      <View style={styles.valueRow}>
        <Label style={[styles.value, { color: c.textPrimary }]}>{value}</Label>
        {unit && <Caption style={styles.unit}>{unit}</Caption>}
      </View>
      <View style={styles.bottomRow}>
        {hasTrend && (
          <View style={styles.trendRow}>
            <Ionicons
              name={up ? 'arrow-up' : 'arrow-down'}
              size={11}
              color={up ? c.success : c.error}
            />
            <Caption style={{ color: up ? c.success : c.error }}>
              {Math.abs(Math.round(trendPct!))}%
            </Caption>
          </View>
        )}
        {series && series.length > 0 && (
          <View style={styles.spark}>
            <Sparkline values={series} color={color} height={22} target={target} />
          </View>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 140,
    padding: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { color: colors.textMuted, fontSize: 11, letterSpacing: 0.5 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  value: { fontFamily: fonts.heading, fontSize: fontSizes.xl },
  unit: { color: colors.textMuted, fontSize: 11 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  spark: { flex: 1, minWidth: 40 },
});
