import { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Body, Label, Caption } from '@/components/ui/Typography';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { CalorieRing } from '@/components/modules/health/CalorieRing';
import { FoodEntryRow } from '@/components/modules/health/FoodEntryRow';
import { WeightChart } from '@/components/modules/health/WeightChart';
import { BloodReportCard } from '@/components/modules/health/BloodReportCard';
import { AddFoodSheet, type FoodEntryEdit } from '@/components/modules/health/AddFoodSheet';
import { MealSuggestionsCard } from '@/components/modules/health/MealSuggestionsCard';
import { VitalsCard } from '@/components/modules/health/VitalsCard';
import { HealthSummaryCard } from '@/components/modules/health/HealthSummaryCard';
import { EditVitalsSheet } from '@/components/modules/health/EditVitalsSheet';
import { WaterCard } from '@/components/modules/health/WaterCard';
import { EnergyCard } from '@/components/modules/health/EnergyCard';
import { RecoveryCard } from '@/components/modules/health/RecoveryCard';
import {
  getFoodEntriesByDate,
  getRecentWeightLogs,
  getBloodReports,
  createHealthLog,
  deleteFoodEntry,
  getWaterMlForDate,
  getLatestEnergyForDate,
  getLatestSleepHours,
} from '@/db/queries/health';
import { getUser, updateUser } from '@/db/queries/users';
import { useScreenTracking } from '@/hooks/useScreenTracking';
import { weightTrend, summarizeVitals, calorieTargets } from '@/utils/health';
import { recoveryFromFitDays, computeRecoveryScore } from '@/utils/recovery';
import { useAI } from '@/hooks/useAI';
import { parseBloodReport } from '@/ai/functions';
import { useGameStore } from '@/store/useGameStore';
import { XP_VALUES } from '@/utils/gamification';
import { useUserStore } from '@/store/useUserStore';
import { useFitSyncStore } from '@/store/useFitSyncStore';
import { logBehaviourEvent } from '@/db/queries/behaviour';
import type { BloodReportResult } from '@/ai/types';
import {
  isFitConnected,
  startFitOAuth,
  clearFitTokens,
} from '@/integrations/googleFit/oauth';
import { syncFitDailyData } from '@/integrations/googleFit/client';
import { FitDashboard } from '@/components/modules/health/FitDashboard';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type Section = 'calories' | 'blood';
type FoodEntry = {
  id: string;
  date: string;
  mealType: string;
  foodName: string;
  quantityG: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre?: number;
  source: string;
  createdAt: string;
};

export default function HealthScreen() {
  useScreenTracking('health');
  const c = useColors();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  const [weightLogs, setWeightLogs] = useState<{ date: string; weight: number }[]>([]);
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [userAge, setUserAge] = useState<number | null>(null);
  const [goalType, setGoalType] = useState<string | null>(null);
  const [sex, setSex] = useState<string | null>(null);
  const [activityLevel, setActivityLevel] = useState<string | null>(null);
  const [waterMl, setWaterMl] = useState(0);
  const [energy, setEnergy] = useState<number | null>(null);
  const [sleepTargetHours, setSleepTargetHours] = useState<number | null>(null);
  const [latestSleepHours, setLatestSleepHours] = useState<number | null>(null);
  const [bloodReportResult, setBloodReportResult] = useState<BloodReportResult | null>(null);
  const [showAddFood, setShowAddFood] = useState(false);
  const [editEntry, setEditEntry] = useState<FoodEntryEdit | null>(null);
  const [showEditVitals, setShowEditVitals] = useState(false);
  const [activeMealType, setActiveMealType] = useState<MealType>('breakfast');
  const [openSection, setOpenSection] = useState<Section | null>(null);
  const [fitConnected, setFitConnected] = useState(false);
  const [fitSyncing, setFitSyncing] = useState(false);
  const [fitStatus, setFitStatus] = useState<string | null>(null);
  // Synced Fit data is cached in a persisted store so it survives navigating
  // away from the tab — otherwise the dashboard cleared and forced a re-sync.
  const fitDays = useFitSyncStore((s) => s.days);
  const fitWorkouts = useFitSyncStore((s) => s.workouts);
  const setFitSync = useFitSyncStore((s) => s.setSync);
  const clearFitSync = useFitSyncStore((s) => s.clear);
  const { call, loading } = useAI();
  const { userId } = useUserStore();
  const { awardBadge, addXP } = useGameStore();
  const advanceQuest = useGameStore((s) => s.advanceQuest);
  const triggerStreak = useGameStore((s) => s.triggerStreak);
  const streaks = useGameStore((s) => s.streaks);

  const loadData = useCallback(() => {
    setFoodEntries(
      getFoodEntriesByDate(today).map((entry) => ({
        ...entry,
        fibre: entry.fibre ?? undefined,
      })),
    );
    const weights = getRecentWeightLogs(30);
    setWeightLogs(
      weights
        .filter((w) => w.weight !== null)
        .map((w) => ({ date: w.date, weight: w.weight! })),
    );
    const user = getUser();
    setHeightCm(user?.heightCm ?? null);
    setUserAge(user?.age ?? null);
    setGoalType(user?.healthGoalType ?? null);
    setSex(user?.sex ?? null);
    setActivityLevel(user?.activityLevel ?? null);
    setSleepTargetHours(user?.sleepTargetHours ?? null);
    setWaterMl(getWaterMlForDate(today));
    setEnergy(getLatestEnergyForDate(today));
    setLatestSleepHours(getLatestSleepHours(2));

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
    clearFitSync();
    setFitStatus('Disconnected.');
  };

  const handleFitSync = async () => {
    const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) { setFitStatus('Missing EXPO_PUBLIC_GOOGLE_CLIENT_ID.'); return; }
    setFitSyncing(true);
    setFitStatus(null);
    try {
      const result = await syncFitDailyData(clientId, 14);
      setFitSync(result.days, result.workouts, Date.now());
      const today = result.days[result.days.length - 1];
      if (today && today.weightKg && today.weightKg > 0) {
        createHealthLog({ date: today.date, weight: today.weightKg });
      }
      // Persist sleep across the synced window so recovery-aware planning can read it.
      for (const day of result.days) {
        const totalMins = day.sleep.total;
        if (totalMins > 0) {
          createHealthLog({
            date: day.date,
            sleepHours: Math.round((totalMins / 60) * 10) / 10,
            source: 'health_connect',
          });
        }
      }
      // Compute + persist today's recovery score so the Routine Builder can
      // read it (getLatestRecoveryScore) when softening the rest of the day.
      const latestDate = result.days[result.days.length - 1]?.date;
      const rec = recoveryFromFitDays(result.days, sleepTargetHours ?? undefined);
      if (latestDate && rec.hasData) {
        createHealthLog({ date: latestDate, recoveryScore: rec.score });
      }
      // A workout logged today (via Fit) keeps the workout streak alive.
      if (userId && latestDate && result.workouts.some((w) => w.date === latestDate)) {
        triggerStreak(userId, 'workout');
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

  const targets = useMemo(
    () =>
      calorieTargets({
        weightKg: trend.latest,
        heightCm,
        age: userAge,
        goalType,
        sex,
        activityLevel,
      }),
    [trend.latest, heightCm, userAge, goalType, sex, activityLevel],
  );

  // Hydration goal ≈ 35 ml per kg bodyweight (rounded to 100ml), default 2.5 L.
  const waterGoalMl = useMemo(
    () => (trend.latest ? Math.round((trend.latest * 35) / 100) * 100 : 2500),
    [trend.latest],
  );

  // Readiness score: rich when Google Fit is synced, else sleep-only fallback.
  const recovery = useMemo(
    () =>
      fitDays.length > 0
        ? recoveryFromFitDays(fitDays, sleepTargetHours ?? undefined)
        : computeRecoveryScore({ sleepHours: latestSleepHours, sleepNeedHours: sleepTargetHours ?? undefined }),
    [fitDays, sleepTargetHours, latestSleepHours],
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

  const handleSaveVitals = (data: { weightKg?: number; heightCm?: number; sex?: string; activityLevel?: string }) => {
    if (data.weightKg != null) {
      createHealthLog({ date: today, weight: data.weightKg });
      logBehaviourEvent('weight_logged', 'health');
      if (userId) addXP(userId, 10);
    }
    const profile: { heightCm?: number; sex?: string; activityLevel?: string } = {};
    if (data.heightCm != null) profile.heightCm = data.heightCm;
    if (data.sex != null) profile.sex = data.sex;
    if (data.activityLevel != null) profile.activityLevel = data.activityLevel;
    if (userId && Object.keys(profile).length > 0) {
      updateUser(userId, profile);
    }
    loadData();
  };

  const handleUploadReport = async () => {
    const result = await call(() => parseBloodReport('Sample blood report data'));
    if (result) setBloodReportResult(result);
  };

  const openAddFood = (meal: MealType) => {
    setEditEntry(null);
    setActiveMealType(meal);
    setShowAddFood(true);
  };

  // Shared post-log path: behaviour event, food-log streak, refresh. Used by
  // both the manual/photo add sheet and the AI meal suggestions.
  const handleFoodLogged = () => {
    logBehaviourEvent('food_logged', 'health');
    advanceQuest('q_food', 1);
    if (userId) {
      triggerStreak(userId, 'foodTracking');
      // Logging a meal awards XP, same as any tracked action — previously only
      // the photo-recognition path credited XP, so manual logging advanced the
      // streak/quest but never moved the XP total (QA GAM finding).
      addXP(userId, XP_VALUES.logFood);
    }
    loadData();
  };

  const handleEditFood = (entry: FoodEntry) => {
    setEditEntry({
      id: entry.id,
      mealType: entry.mealType,
      foodName: entry.foodName,
      quantityG: entry.quantityG,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
    });
    setActiveMealType((entry.mealType as MealType) ?? 'snack');
    setShowAddFood(true);
  };

  const handleDeleteFood = (id: string) => {
    deleteFoodEntry(id);
    loadData();
  };

  const closeAddFood = () => {
    setShowAddFood(false);
    setEditEntry(null);
  };

  // Flagged blood markers bias meal suggestions toward foods that address them.
  const flaggedMarkers = useMemo(
    () =>
      (bloodReportResult?.markers ?? [])
        .filter((m) => m.status === 'high' || m.status === 'low')
        .map((m) => ({ marker: m.marker, status: m.status as 'high' | 'low' })),
    [bloodReportResult],
  );

  const toggleSection = (s: Section) => setOpenSection((cur) => (cur === s ? null : s));

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <AuroraBackground />
      <SafeAreaView style={styles.container}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <ModuleHeader title="Health" domain="health" color={c.health} />

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

        <Animated.View entering={FadeInDown.delay(250).duration(400)}>
          <Card style={styles.streakCard}>
            <View style={styles.streakHeader}>
              <Ionicons name="flame" size={16} color={c.health} />
              <SectionLabel>STREAKS</SectionLabel>
            </View>
            <View style={styles.streakRow}>
              {([
                ['workout', 'Workout', '💪'],
                ['foodTracking', 'Food log', '🥗'],
              ] as const).map(([key, label, emoji]) => (
                <View key={key} style={styles.streakItem}>
                  <Body style={styles.streakCount}>{streaks[key].count}</Body>
                  <Caption style={{ color: c.textSecondary }}>{emoji} {label}</Caption>
                </View>
              ))}
            </View>
          </Card>
        </Animated.View>

        {recovery.hasData && (
          <Animated.View entering={FadeInDown.delay(275).duration(400)}>
            <RecoveryCard result={recovery} />
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <WaterCard totalMl={waterMl} goalMl={waterGoalMl} onLogged={loadData} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350).duration(400)}>
          <EnergyCard current={energy} onLogged={loadData} />
        </Animated.View>

        <Card style={styles.fitCard}>
          <View style={styles.fitHeader}>
            <Ionicons name="fitness" size={18} color={c.health} />
            <SectionLabel>GOOGLE FIT</SectionLabel>
          </View>
          {fitConnected ? (
            <>
              <Caption style={{ color: c.textSecondary }}>
                Pulls the last 14 days of steps, heart rate, sleep, and weight.
              </Caption>
              <View style={styles.fitActions}>
                <Pressable
                  style={[styles.fitPrimary, { backgroundColor: c.health }, fitSyncing && { opacity: 0.6 }]}
                  onPress={handleFitSync}
                  disabled={fitSyncing}
                >
                  <Ionicons name="sync" size={14} color="#fff" />
                  <Caption style={{ color: '#fff', fontFamily: fonts.heading }}>
                    {fitSyncing ? 'Syncing…' : 'Sync last 14 days'}
                  </Caption>
                </Pressable>
                <Pressable style={styles.fitSecondary} onPress={handleFitDisconnect}>
                  <Caption style={{ color: c.textMuted }}>Disconnect</Caption>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Caption style={{ color: c.textSecondary }}>
                Connect Google Fit to pull steps, heart rate, sleep, and weight automatically.
              </Caption>
              <Pressable
                style={[styles.fitPrimary, { backgroundColor: c.health, alignSelf: 'flex-start' }]}
                onPress={handleFitConnect}
              >
                <Ionicons name="link" size={14} color="#fff" />
                <Caption style={{ color: '#fff', fontFamily: fonts.heading }}>Connect Google Fit</Caption>
              </Pressable>
            </>
          )}
          {fitStatus && <Caption style={{ color: c.textMuted }}>{fitStatus}</Caption>}
        </Card>

        {fitConnected && fitDays.length > 0 && (
          <FitDashboard days={fitDays} workouts={fitWorkouts} />
        )}

        {/* Calorie Tracking — collapsible sub-section */}
        <Pressable onPress={() => toggleSection('calories')}>
          <Card style={styles.sectionHeader}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <SectionLabel color={c.health}>CALORIE TRACKING</SectionLabel>
                <Caption>
                  {Math.round(totals.calories)} / {targets.calories} kcal today
                  {targets.estimated ? '' : ' · add age + vitals to personalise'}
                </Caption>
              </View>
              <Ionicons
                name={openSection === 'calories' ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={c.textSecondary}
              />
            </View>
          </Card>
        </Pressable>

        {openSection === 'calories' && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.sectionBody}>
            <CalorieRing
              consumed={totals.calories}
              target={targets.calories}
              protein={totals.protein}
              carbs={totals.carbs}
              fat={totals.fat}
              proteinTarget={targets.protein}
              carbsTarget={targets.carbs}
              fatTarget={targets.fat}
            />

            <View style={styles.mealsSection}>
              <Body style={styles.sectionTitle}>Today&apos;s Meals</Body>
              {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((meal) => (
                <Card key={meal} style={styles.mealCard}>
                  <View style={styles.mealHeader}>
                    <Label>{meal.charAt(0).toUpperCase() + meal.slice(1)}</Label>
                    <Pressable
                      onPress={() => openAddFood(meal)}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${meal}`}
                    >
                      <Ionicons name="add-circle" size={24} color={c.health} />
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
                        onEdit={() => handleEditFood(entry)}
                        onDelete={() => handleDeleteFood(entry.id)}
                      />
                    ))
                  ) : (
                    <Caption style={styles.emptyMeal}>No entries yet</Caption>
                  )}
                </Card>
              ))}
            </View>

            <MealSuggestionsCard
              calorieTarget={targets.calories}
              caloriesEaten={totals.calories}
              proteinEaten={totals.protein}
              carbsEaten={totals.carbs}
              fatEaten={totals.fat}
              bloodMarkers={flaggedMarkers}
              onLogged={handleFoodLogged}
            />
          </Animated.View>
        )}

        {/* Blood Reports — collapsible sub-section */}
        <Pressable onPress={() => toggleSection('blood')}>
          <Card style={styles.sectionHeader}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <SectionLabel color={c.health}>BLOOD REPORTS</SectionLabel>
                <Caption>
                  {bloodReportResult ? 'Latest report available' : 'No reports yet'}
                </Caption>
              </View>
              <Ionicons
                name={openSection === 'blood' ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={c.textSecondary}
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
                    <Body style={[styles.loadingText, { color: c.textSecondary }]}>Analysing your blood report...</Body>
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
        initialSex={sex}
        initialActivityLevel={activityLevel}
        onClose={() => setShowEditVitals(false)}
        onSave={handleSaveVitals}
      />

      <AddFoodSheet
        visible={showAddFood}
        mealType={activeMealType}
        editEntry={editEntry}
        onClose={closeAddFood}
        onSaved={() => {
          // Editing an existing entry shouldn't re-trigger the streak/quest.
          if (editEntry) {
            loadData();
            return;
          }
          handleFoodLogged();
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  loadingText: {},
  streakCard: { gap: spacing.sm },
  streakHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  streakRow: { flexDirection: 'row', gap: spacing.xl },
  streakItem: { alignItems: 'flex-start', gap: 2 },
  streakCount: { fontFamily: fonts.display, fontSize: fontSizes.xxl },
  fitCard: { gap: spacing.sm },
  fitHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  fitActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  fitPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12,
  },
  fitSecondary: { paddingVertical: 10, paddingHorizontal: 10 },
});
