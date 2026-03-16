import { View, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
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
}

export function FoodEntryRow({ foodName, calories, protein, carbs, fat, quantityG }: FoodEntryRowProps) {
  return (
    <View style={styles.container}>
      <View style={styles.main}>
        <Body style={styles.name}>{foodName}</Body>
        <Caption>{Math.round(quantityG)}g</Caption>
      </View>
      <View style={styles.macros}>
        <Caption style={styles.cal}>{Math.round(calories)} kcal</Caption>
        <Caption>P:{Math.round(protein)}g C:{Math.round(carbs)}g F:{Math.round(fat)}g</Caption>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
