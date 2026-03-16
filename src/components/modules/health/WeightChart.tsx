import { View, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Body, Caption, Label } from '@/components/ui/Typography';

interface WeightEntry {
  date: string;
  weight: number;
}

interface WeightChartProps {
  entries: WeightEntry[];
}

export function WeightChart({ entries }: WeightChartProps) {
  if (entries.length === 0) {
    return (
      <Card>
        <Label>Weight</Label>
        <Caption style={styles.empty}>No weight data yet. Log your weight to see trends.</Caption>
      </Card>
    );
  }

  const latest = entries[0];
  const min = Math.min(...entries.map((e) => e.weight));
  const max = Math.max(...entries.map((e) => e.weight));
  const range = max - min || 1;

  return (
    <Card>
      <View style={styles.header}>
        <Label>Weight</Label>
        <Body style={styles.latest}>{latest.weight} kg</Body>
      </View>
      <View style={styles.chart}>
        {entries.slice(0, 7).reverse().map((entry, i) => {
          const height = ((entry.weight - min) / range) * 40 + 10;
          return (
            <View key={i} style={styles.bar}>
              <View style={[styles.barFill, { height, backgroundColor: colors.health }]} />
              <Caption style={styles.barLabel}>{entry.date.slice(5)}</Caption>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  latest: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    color: colors.health,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 70,
    marginTop: spacing.md,
  },
  bar: {
    alignItems: 'center',
    flex: 1,
  },
  barFill: {
    width: 8,
    borderRadius: 4,
  },
  barLabel: {
    marginTop: spacing.xs,
    fontSize: 9,
  },
  empty: {
    marginTop: spacing.sm,
  },
});
