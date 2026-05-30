import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Caption } from '@/components/ui/Typography';

interface FoodEntryRowProps {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  quantityG: number;
  /** Tap the row to edit (opens the editor prefilled). */
  onEdit?: () => void;
  /** Tap the trash icon to delete this entry. */
  onDelete?: () => void;
}

export function FoodEntryRow({ foodName, calories, protein, carbs, fat, quantityG, onEdit, onDelete }: FoodEntryRowProps) {
  const c = useColors();
  const styles = makeStyles(c);
  return (
    <Pressable
      style={styles.container}
      onPress={onEdit}
      disabled={!onEdit}
      accessibilityRole={onEdit ? 'button' : undefined}
      accessibilityLabel={onEdit ? `Edit ${foodName}` : undefined}
    >
      <View style={styles.main}>
        <Body style={styles.name}>{foodName}</Body>
        <Caption>{Math.round(quantityG)}g</Caption>
      </View>
      <View style={styles.macros}>
        <Caption style={styles.cal}>{Math.round(calories)} kcal</Caption>
        <Caption>P:{Math.round(protein)}g C:{Math.round(carbs)}g F:{Math.round(fat)}g</Caption>
      </View>
      {onDelete && (
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          style={styles.deleteBtn}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${foodName}`}
        >
          <Ionicons name="trash-outline" size={16} color={c.textMuted} />
        </Pressable>
      )}
    </Pressable>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  main: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: fonts.bodyMedium,
  },
  macros: {
    alignItems: 'flex-end',
    gap: 2,
  },
  cal: {
    fontFamily: fonts.bodyMedium,
    color: colors.health,
  },
  deleteBtn: {
    paddingLeft: spacing.sm,
    justifyContent: 'center',
  },
});
