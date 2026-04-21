import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Heading, Label, Caption } from '@/components/ui/Typography';
import { bmiCategoryLabel, type BMICategory } from '@/utils/health';

interface Props {
  weightKg: number | null;
  heightCm: number | null;
  bmi: number | null;
  category: BMICategory | null;
  trendDirection: 'up' | 'down' | 'flat' | null;
  trendDelta: number | null;
  onEdit: () => void;
}

const categoryColor = (c: BMICategory | null): string => {
  if (c === 'healthy') return colors.success;
  if (c === 'overweight') return colors.warning;
  if (c === 'obese') return colors.error;
  if (c === 'underweight') return colors.warning;
  return colors.textMuted;
};

export function VitalsCard({
  weightKg,
  heightCm,
  bmi,
  category,
  trendDirection,
  trendDelta,
  onEdit,
}: Props) {
  const trendIcon =
    trendDirection === 'up' ? 'trending-up' : trendDirection === 'down' ? 'trending-down' : 'remove';
  const trendColor =
    trendDirection === 'up' ? colors.warning : trendDirection === 'down' ? colors.success : colors.textMuted;

  return (
    <Card moduleColor={colors.health} style={styles.card}>
      <View style={styles.headerRow}>
        <Label color={colors.health}>VITALS</Label>
        <Pressable onPress={onEdit} hitSlop={8} style={styles.editBtn}>
          <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
          <Label color={colors.textSecondary}>Edit</Label>
        </Pressable>
      </View>

      <View style={styles.bmiRow}>
        <View>
          <Caption>BMI</Caption>
          <Heading style={styles.bmiNumber}>{bmi != null ? bmi : '—'}</Heading>
          {category && (
            <Label color={categoryColor(category)}>{bmiCategoryLabel(category)}</Label>
          )}
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Caption>Weight</Caption>
            <Label>{weightKg != null ? `${weightKg} kg` : '—'}</Label>
            {trendDelta != null && (
              <View style={styles.trendRow}>
                <Ionicons name={trendIcon} size={12} color={trendColor} />
                <Caption style={{ color: trendColor }}>
                  {trendDelta > 0 ? '+' : ''}
                  {trendDelta} kg
                </Caption>
              </View>
            )}
          </View>
          <View style={styles.stat}>
            <Caption>Height</Caption>
            <Label>{heightCm != null ? `${heightCm} cm` : '—'}</Label>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bmiRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  bmiNumber: { fontSize: 44, lineHeight: 48 },
  stats: { gap: spacing.sm, alignItems: 'flex-end' },
  stat: { alignItems: 'flex-end', gap: 2 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
