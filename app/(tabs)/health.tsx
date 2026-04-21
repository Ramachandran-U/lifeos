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
import { VitalsCard } from '@/components/modules/health/VitalsCard';
import { HealthSummaryCard } from '@/components/modules/health/HealthSummaryCard';
import { EditVitalsSheet } from '@/components/modules/health/EditVitalsSheet';
import {
  getFoodEntriesByDate,
  getRecentWeightLogs,
  getBloodReports,
  createHealthLog,
} from '@/db/queries/health';
import { getUser, updateUser } from '@/db/queries/users';
import { weightTrend, summarizeVitals } from '@/utils/health';
import { useAI } from '@/hooks/useAI';
import { parseBloodReport } from '@/ai/functions';
import { useGameStore } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { logBehaviourEvent } from '@/db/queries/behaviour';
import type { BloodReportResult } from '@/ai/types';
import {
  isFitConnected,
  startFitOAuth,
  clearFitTokens,
} from '@/integrations/googleFit/oauth';
import { syncFitDailyData, type DailyFitPoint, type WorkoutSession } from '@/integrations/googleFit/client';
import { FitDashboard } from '@/components/modules/health/FitDashboard';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type Section = 'calories' | 'blood';

const CALORIE_TARGET = 2000;

export default function HealthScreen() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [foodEntries, setFoodEntries] = useState<ReturnType<typeof getFoodEntriesByDate>>([]);
  const [weightLogs, setWeightLogs] = useState<{ date: string; weight: number }[]>([]);
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [bloodReportResult, setBloodReportResult] = useState<BloodReportResult | null>(null);
  const [showAddFood, setShowAddFood] = useState(false);
  const [showEditVitals, setShowEditVitals] = useState(false);
  const [activeMealType, setActiveMealType] = useState<MealType>('breakfast');
  const [openSection, setOpenSection] = useState<Section | null>(null);
  const [fitConnected, setFitConnected] = useState(false);
  const [fitSyncing, setFitSyncing] = useState(false);
  const [fitStatus, setFitStatus] = useState<string | null>(null);
  const [fitDays, setFitDays] = useState<DailyFitPoint[]>([]);
  const [fitWorkouts, setFitWorkouts] = useState<WorkoutSession[]>([]);
  const { call, loading } = useAI();
  const { userId } = useUserStore();
  const { awardBadge, addXP } = useGameStore();

  const loadData = useCallback(() => {
    setFoodEntries(getFoodEntriesByDate(today));
    const weights = getRecentWeightLogs(30);
    setWeightLogs(
      weights
        .filter((w) => w.weight !== null)
        .map((w) => ({ date: w.date, weight: w.weight! })),
    );
    const user = getUser();
    setHeightCm(user?.heightCm ?? null);

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

  useFocusEffect(useCallback(() => {
    loadData();
    setFitConnected(isFitConnected());
  }, [loadData]));

  const handleFitConnect = async () => {
    const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setFitStatus('Missing EXPO_PUBLIC_GOOGLE_CLIENT_ID — see .env.example.');
      return;
    }
    await startFitOAuth(clientId);
  };

  const handleFitDisconnect = () => {
    clearFitTokens();
    setFitConnected(false);
    setFitDays([]);
    setFitWorkouts([]);
    setFitStatus('Disconnected.');
  };

  const handleFitSync = async () => {
    const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) { setFitStatus('Missing EXPO_PUBLIC_GOOGLE_CLIENT_ID.'); return; }
    setFitSyncing(true);
    setFitStatus(null);
    try {
      const result = await syncFitDailyData(clientId, 14);
      setFitDays(result.days);
      setFitWorkouts(result.workouts);
      const today = result.days[result.days.length - 1];
      if (today && today.weightKg && today.weightKg > 0) {
        createHealthLog({ date: today.date, weight: today.weightKg });
      }
      const totalSteps = result.days.reduce((s, d) => s + d.steps, 0);
      setFitStatus(
        `Synced 14 days · ${totalSteps.toLocaleString()} steps · ${result.workouts.length} workouts` +
        (result.errors.length ? ` · ${result.errors.length} errors` : ''),
      );
      loadData();
    } catch (err) {
      setFitStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setFitSyncing(false);
    }
  };

  const trend = useMemo(() => weightTrend(weightLogs), [weightLogs]);
  const summary = useMemo(
    () =>
      summarizeVitals({
        weightKg: trend.latest,
        heightCm,
        trendDirection: trend.direction,
      }),
    [trend, heightCm],
  );

  const totals = useMemo(() => {
    return foodEntries.reduce(
      (acc, e) => ({
        calories: acc.calories + e.calories,
        protein: acc.protein + e.protein,
        carbs: acc.carbs + e.carbs,
        fat: acc.fat + e.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
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

  const handleSaveVitals = (data: { weightKg?: number; heightCm?: number }) => {
    if (data.weightKg != null) {
      createHealthLog({ date: today, weight: data.weightKg });
      logBehaviourEvent('weight_logged', 'health');
      if (userId) addXP(userId, 10);
    }
    if (data.heightCm != null && userId) {
      updateUser(userId, { heightCm: data.heightCm });
    }
    loadData();
  };

  const handleUploadReport = async () => {
    const result = await call(() => parseBloodReport('Sample blood report data'));
    if (result) setBloodReportResult(result);
  };

  const openAddFood = (meal: MealType) => {
    setActiveMealType(meal);
    setShowAddFood(true);
  };

  const toggleSection = (s: Section) => setOpenSection((cur) => (cur === s ? null : s));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <ModuleHeader title="Health" icon="heart" color={colors.health} />

        <Animated.View entering={FadeInDown.duration(400)}>
          <VitalsCard
            weightKg={trend.latest}
            heightCm={heightCm}
            bmi={summary.bmi}
            category={summary.category}
            trendDirection={trend.direction}
            trendDelta={trend.delta}
            onEdit={() => setShowEditVitals(true)}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <HealthSummaryCard summary={summary} />
        </Animated.View>

        {weightLogs.length > 1 && (
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <WeightChart entries={weightLogs.slice(0, 7)} />
          </Animated.View>
        )}

        <Card style={styles.fitCard}>
          <View style={styles.fitHeader}>
            <Ionicons name="fitness" size={18} color={colors.health} />
            <Label>GOOGLE FIT</Label>
          </View>
          {fitConnected ? (
            <>
              <Caption style={{ color: colors.textSecondary }}>
                Pulls the last 7 days of steps, heart rate, sleep, and weight.
              </Caption>
              <View style={styles.fitActions}>
                <Pressable
                  style={[styles.fitPrimary, { backgroundColor: colors.health }, fitSyncing && { opacity: 0.6 }]}
                  onPress={handleFitSync}
                  disabled={fitSyncing}
                >
                  <Ionicons name="sync" size={14} color="#fff" />
                  <Caption style={{ color: '#fff', fontFamily: fonts.heading }}>
                    {fitSyncing ? 'Syncing…' : 'Sync last 7 days'}
                  </Caption>
                </Pressable>
                <Pressable style={styles.fitSecondary} onPress={handleFitDisconnect}>
                  <Caption style={{ color: colors.textMuted }}>Disconnect</Caption>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Caption style={{ color: colors.textSecondary }}>
                Connect Google Fit to pull steps, heart rate, sleep, and weight automatically.
              </Caption>
              <Pressable
                style={[styles.fitPrimary, { backgroundColor: colors.health, alignSelf: 'flex-start' }]}
                onPress={handleFitConnect}
              >
                <Ionicons name="link" size={14} color="#fff" />
                <Caption style={{ color: '#fff', fontFamily: fonts.heading }}>Connect Google Fit</Caption>
              </Pressable>
            </>
          )}
          {fitStatus && <Caption style={{ color: colors.textMuted }}>{fitStatus}</Caption>}
        </Card>

        {fitConnected && fitDays.length > 0 && (
          <FitDashboard days={fitDays} workouts={fitWorkouts} />
        )}

        {/* Calorie Tracking — collapsible sub-section */}
        <Pressable onPress={() => toggleSection('calories')}>
          <Card style={styles.sectionHeader}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Label>CALORIE TRACKING</Label>
                <Caption>
                  {Math.round(totals.calories)} / {CALORIE_TARGET} kcal today
                </Caption>
              </View>
              <Ionicons
                name={openSection === 'calories' ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textSecondary}
              />
            </View>
          </Card>
        </Pressable>

        {openSection === 'calories' && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.sectionBody}>
            <CalorieRing
              consumed={totals.calories}
              target={CALORIE_TARGET}
              protein={totals.protein}
              carbs={totals.carbs}
              fat={totals.fat}
            />

            <View style={styles.mealsSection}>
              <Body style={styles.sectionTitle}>Today&apos;s Meals</Body>
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
          </Animated.View>
        )}

        {/* Blood Reports — collapsible sub-section */}
        <Pressable onPress={() => toggleSection('blood')}>
          <Card style={styles.sectionHeader}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Label>BLOOD REPORTS</Label>
                <Caption>
                  {bloodReportResult ? 'Latest report available' : 'No reports yet'}
                </Caption>
              </View>
              <Ionicons
                name={openSection === 'blood' ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textSecondary}
              />
            </View>
          </Card>
        </Pressable>

        {openSection === 'blood' && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.sectionBody}>
            {bloodReportResult ? (
              <BloodReportCard result={bloodReportResult} date={today} />
            ) : (
              <Card style={styles.uploadCard}>
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <LoadingDots />
                    <Body style={styles.loadingText}>Analysing your blood report...</Body>
                  </View>
                ) : (
                  <>
                    <Caption style={styles.uploadDesc}>
                      Upload a blood report for AI analysis
                    </Caption>
                    <Button title="Upload Report" variant="secondary" onPress={handleUploadReport} />
                  </>
                )}
              </Card>
            )}
          </Animated.View>
        )}
      </ScrollView>

      <EditVitalsSheet
        visible={showEditVitals}
        initialWeightKg={trend.latest}
        initialHeightCm={heightCm}
        onClose={() => setShowEditVitals(false)}
        onSave={handleSaveVitals}
      />

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
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  sectionHeader: {},
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionBody: { gap: spacing.md },
  mealsSection: { gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.heading, fontSize: fontSizes.lg },
  mealCard: { gap: spacing.xs },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emptyMeal: { paddingVertical: spacing.sm },
  uploadCard: { gap: spacing.sm },
  uploadDesc: { marginTop: spacing.xs },
  loadingContainer: { alignItems: 'center', paddingVertical: spacing.md, gap: spacing.sm },
  loadingText: { color: colors.textSecondary },
  fitCard: { gap: spacing.sm },
  fitHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  fitActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  fitPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12,
  },
  fitSecondary: { paddingVertical: 10, paddingHorizontal: 10 },
});
