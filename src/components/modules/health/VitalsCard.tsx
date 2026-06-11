import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
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

const categoryColor = (cat: BMICategory | null, colors: AppColors): string => {
  if (cat === 'healthy') return colors.success;
  if (cat === 'overweight') return colors.warning;
  if (cat === 'obese') return colors.error;
  if (cat === 'underweight') return colors.warning;
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
  const c = useColors();
  const styles = makeStyles(c);
  const trendIcon =
    trendDirection === 'up' ? 'trending-up' : trendDirection === 'down' ? 'trending-down' : 'remove';
  const trendColor =
    trendDirection === 'up' ? c.warning : trendDirection === 'down' ? c.success : c.textMuted;

  return (
    // Neutral card — the green lives in the eyebrow + BMI numeral (R2).
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Label color={c.healthText}>VITALS</Label>
        <Pressable onPress={onEdit} hitSlop={8} style={styles.editBtn}>
          <Ionicons name="create-outline" size={18} color={c.textSecondary} />
          <Label color={c.textSecondary}>Edit</Label>
        </Pressable>
      </View>

      <View style={styles.bmiRow}>
        <View>
          <Caption>BMI</Caption>
          {/* R2 — the score numeral renders in the domain ink. */}
          <Heading style={[styles.bmiNumber, { color: c.healthText }]}>{bmi != null ? bmi : '—'}</Heading>
          {category && (
            <Label color={categoryColor(category, c)}>{bmiCategoryLabel(category)}</Label>
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

const makeStyles = (colors: AppColors) => StyleSheet.create({
  card: { gap: spacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bmiRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  bmiNumber: { fontSize: 44, lineHeight: 48 },
  stats: { gap: spacing.sm, alignItems: 'flex-end' },
  stat: { alignItems: 'flex-end', gap: 2 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
