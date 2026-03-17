import { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Body, Label, Caption } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { CalorieRing } from '@/components/modules/health/CalorieRing';
import { FoodEntryRow } from '@/components/modules/health/FoodEntryRow';
import { WeightChart } from '@/components/modules/health/WeightChart';
import { BloodReportCard } from '@/components/modules/health/BloodReportCard';
import { AddFoodSheet } from '@/components/modules/health/AddFoodSheet';
import { getFoodEntriesByDate, getRecentWeightLogs, getBloodReports } from '@/db/queries/health';
import { useAI } from '@/hooks/useAI';
import { parseBloodReport } from '@/ai/functions';
import { useGameStore } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { logBehaviourEvent } from '@/db/queries/behaviour';
import type { BloodReportResult } from '@/ai/types';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const CALORIE_TARGET = 2000;

export default function HealthScreen() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [foodEntries, setFoodEntries] = useState<ReturnType<typeof getFoodEntriesByDate>>([]);
  const [weightLogs, setWeightLogs] = useState<{ date: string; weight: number }[]>([]);
  const [bloodReportResult, setBloodReportResult] = useState<BloodReportResult | null>(null);
  const [showAddFood, setShowAddFood] = useState(false);
  const [activeMealType, setActiveMealType] = useState<MealType>('breakfast');
  const { call, loading } = useAI();
  const { userId } = useUserStore();
  const { awardBadge, addXP } = useGameStore();

  const loadData = useCallback(() => {
    setFoodEntries(getFoodEntriesByDate(today));
    const weights = getRecentWeightLogs(7);
    setWeightLogs(
      weights
        .filter((w) => w.weight !== null)
        .map((w) => ({ date: w.date, weight: w.weight! }))
    );
    const reports = getBloodReports();
    if (reports.length > 0 && reports[0].parsedMarkers) {
      try {
        const parsed = JSON.parse(reports[0].parsedMarkers);
        setBloodReportResult({
          markers: parsed,
          summary: reports[0].aiSummary ?? '',
          suggestions: reports[0].aiSuggestions ? JSON.parse(reports[0].aiSuggestions) : [],
        });
      } catch {
        // ignore parse errors
      }
    }
  }, [today]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const totals = useMemo(() => {
    return foodEntries.reduce(
      (acc, e) => ({
        calories: acc.calories + e.calories,
        protein: acc.protein + e.protein,
        carbs: acc.carbs + e.carbs,
        fat: acc.fat + e.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [foodEntries]);

  const mealGroups = useMemo(() => {
    const groups: Record<MealType, typeof foodEntries> = {
      breakfast: [], lunch: [], dinner: [], snack: [],
    };
    for (const entry of foodEntries) {
      const key = entry.mealType as MealType;
      if (groups[key]) groups[key].push(entry);
    }
    return groups;
  }, [foodEntries]);

  const handleUploadReport = async () => {
    const result = await call(() => parseBloodReport('Sample blood report data'));
    if (result) setBloodReportResult(result);
  };

  const openAddFood = (meal: MealType) => {
    setActiveMealType(meal);
    setShowAddFood(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <ModuleHeader title="Health" icon="heart" color={colors.health} />

        <Animated.View entering={FadeInDown.duration(400)}>
          <CalorieRing
            consumed={totals.calories}
            target={CALORIE_TARGET}
            protein={totals.protein}
            carbs={totals.carbs}
            fat={totals.fat}
          />
        </Animated.View>

        <View style={styles.mealsSection}>
          <Body style={styles.sectionTitle}>Today's Meals</Body>
          {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((meal) => (
            <Card key={meal} style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <Label>{meal.charAt(0).toUpperCase() + meal.slice(1)}</Label>
                <Pressable onPress={() => openAddFood(meal)}>
                  <Ionicons name="add-circle" size={24} color={colors.health} />
                </Pressable>
              </View>
              {mealGroups[meal].length > 0 ? (
                mealGroups[meal].map((entry) => (
                  <FoodEntryRow
                    key={entry.id}
                    foodName={entry.foodName}
                    calories={entry.calories}
                    protein={entry.protein}
                    carbs={entry.carbs}
                    fat={entry.fat}
                    quantityG={entry.quantityG}
                  />
                ))
              ) : (
                <Caption style={styles.emptyMeal}>No entries yet</Caption>
              )}
            </Card>
          ))}
        </View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <WeightChart entries={weightLogs} />
        </Animated.View>

        {bloodReportResult ? (
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <BloodReportCard result={bloodReportResult} date={today} />
          </Animated.View>
        ) : (
          <Card style={styles.uploadCard}>
            <Label>Blood Reports</Label>
            {loading ? (
              <View style={styles.loadingContainer}>
                <LoadingDots />
                <Body style={styles.loadingText}>Analysing your blood report...</Body>
              </View>
            ) : (
              <>
                <Caption style={styles.uploadDesc}>Upload a blood report for AI analysis</Caption>
                <Button title="Upload Report" variant="secondary" onPress={handleUploadReport} />
              </>
            )}
          </Card>
        )}
      </ScrollView>

      <AddFoodSheet
        visible={showAddFood}
        mealType={activeMealType}
        onClose={() => setShowAddFood(false)}
        onSaved={() => {
          logBehaviourEvent('food_logged', 'health');
          loadData();
        }}
        onPhotoUsed={() => {
          logBehaviourEvent('photo_food', 'health');
          if (userId) {
            awardBadge(userId, 'food_photo');
            addXP(userId, 20);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  mealsSection: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
  },
  mealCard: {
    gap: spacing.xs,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emptyMeal: {
    paddingVertical: spacing.sm,
  },
  uploadCard: {
    gap: spacing.sm,
  },
  uploadDesc: {
    marginTop: spacing.xs,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
  },
});
