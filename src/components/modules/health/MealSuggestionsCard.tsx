import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Body, Label, Caption } from '@/components/ui/Typography';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { useAI } from '@/hooks/useAI';
import { suggestMeals } from '@/ai/functions';
import { createFoodEntry } from '@/db/queries/health';
import type { MealSuggestion } from '@/ai/types';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

interface MealSuggestionsCardProps {
  calorieTarget: number;
  caloriesEaten: number;
  proteinEaten: number;
  carbsEaten: number;
  fatEaten: number;
  /** Flagged blood markers, if a report is on file — biases suggestions. */
  bloodMarkers?: { marker: string; status: 'high' | 'low' }[];
  /** Fires after a suggested meal is logged, so the parent can refresh + streak. */
  onLogged: () => void;
}

/**
 * Surfaces the `suggestMeals` AI function (previously built but never wired into
 * the UI). Builds the gap context from today's totals + the user's target, asks
 * the model for 2-3 meals to fill it, and lets the user log any of them with one
 * tap into a chosen meal slot.
 */
export function MealSuggestionsCard({
  calorieTarget,
  caloriesEaten,
  proteinEaten,
  carbsEaten,
  fatEaten,
  bloodMarkers,
  onLogged,
}: MealSuggestionsCardProps) {
  const c = useColors();
  const styles = makeStyles(c);
  const { call, loading } = useAI();
  const [suggestion, setSuggestion] = useState<MealSuggestion | null>(null);
  const [logged, setLogged] = useState<Set<number>>(new Set());
  const [targetMeal, setTargetMeal] = useState<MealType>('lunch');

  const remaining = Math.max(0, Math.round(calorieTarget - caloriesEaten));

  const handleSuggest = async () => {
    const context = JSON.stringify({
      calorieTarget,
      caloriesEatenToday: Math.round(caloriesEaten),
      macrosEatenToday: {
        protein: Math.round(proteinEaten),
        carbs: Math.round(carbsEaten),
        fat: Math.round(fatEaten),
      },
      dietaryPreferences: [],
      bloodReportMarkers: bloodMarkers ?? [],
    });
    const result = await call(() => suggestMeals(context));
    if (result) {
      setSuggestion(result);
      setLogged(new Set());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  const handleLog = (index: number) => {
    if (!suggestion) return;
    const meal = suggestion.meals[index];
    createFoodEntry({
      date: format(new Date(), 'yyyy-MM-dd'),
      mealType: targetMeal,
      foodName: meal.name,
      quantityG: 0, // a composed meal suggestion has no single weight
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      source: 'search',
    });
    setLogged((prev) => new Set(prev).add(index));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onLogged();
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="restaurant-outline" size={18} color={c.health} />
        <SectionLabel color={c.health}>MEAL IDEAS</SectionLabel>
      </View>
      <Caption style={{ color: c.textSecondary }}>
        {remaining > 0
          ? `${remaining} kcal left today — get AI meal ideas that fill the gap.`
          : `You've hit your calorie target — see lighter ideas for the rest of the day.`}
      </Caption>

      {loading ? (
        <View style={styles.loading}>
          <LoadingDots />
          <Caption style={{ color: c.textSecondary }}>Finding meals for your remaining macros…</Caption>
        </View>
      ) : (
        <Button
          title={suggestion ? 'Refresh suggestions' : 'Suggest meals'}
          variant="secondary"
          onPress={handleSuggest}
        />
      )}

      {suggestion && (
        <>
          <View style={styles.mealPicker}>
            {MEALS.map((m) => (
              <Pressable
                key={m}
                onPress={() => setTargetMeal(m)}
                style={[styles.mealChip, targetMeal === m && { backgroundColor: c.health, borderColor: c.health }]}
              >
                <Caption style={targetMeal === m ? styles.mealChipTextActive : undefined}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </Caption>
              </Pressable>
            ))}
          </View>

          {suggestion.meals.map((meal, i) => (
            <View key={i} style={styles.meal}>
              <View style={styles.mealMain}>
                <Body style={styles.mealName}>{meal.name}</Body>
                <Caption style={{ color: c.textSecondary }}>{meal.description}</Caption>
                <Caption style={styles.macros}>
                  {Math.round(meal.calories)} kcal · P {Math.round(meal.protein)}g · C {Math.round(meal.carbs)}g · F {Math.round(meal.fat)}g
                </Caption>
              </View>
              <Pressable
                onPress={() => handleLog(i)}
                disabled={logged.has(i)}
                hitSlop={6}
                style={styles.logBtn}
                accessibilityRole="button"
                accessibilityLabel={`Log ${meal.name} to ${targetMeal}`}
              >
                <Ionicons
                  name={logged.has(i) ? 'checkmark-circle' : 'add-circle'}
                  size={26}
                  color={c.health}
                />
              </Pressable>
            </View>
          ))}
          <Caption style={styles.disclaimer}>Estimates — adjust after logging if your portion differs.</Caption>
        </>
      )}
    </Card>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  card: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  loading: { alignItems: 'center', paddingVertical: spacing.md, gap: spacing.sm },
  mealPicker: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginTop: spacing.xs },
  mealChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mealChipTextActive: { color: '#fff', fontFamily: fonts.bodyMedium },
  meal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  mealMain: { flex: 1, gap: 2 },
  mealName: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.md },
  macros: { color: colors.health, fontFamily: fonts.bodyMedium },
  logBtn: { justifyContent: 'center' },
  disclaimer: { color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.xs },
});
