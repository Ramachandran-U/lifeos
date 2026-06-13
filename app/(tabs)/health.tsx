import { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes, TABULAR_NUMS } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { MOTION_BUDGET, useMotionScale, useStaggerDelay } from '@/theme/motion';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { Card } from '@/components/ui/Card';
import { PressableScale } from '@/components/ui/PressableScale';
import { Button } from '@/components/ui/Button';
import { Body, Caption } from '@/components/ui/Typography';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { ConnectRow } from '@/components/ui/ConnectRow';
import { InkCanvas } from '@/components/shared/InkCanvas';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { HealthPulseHero } from '@/components/modules/health/HealthPulseHero';
import { HealthStreakRow } from '@/components/modules/health/HealthStreakRow';
import { CalorieRing } from '@/components/modules/health/CalorieRing';
import { FoodEntryRow } from '@/components/modules/health/FoodEntryRow';
import { WeightChart } from '@/components/modules/health/WeightChart';
import { BloodReportCard } from '@/components/modules/health/BloodReportCard';
import { AddFoodSheet, type FoodEntryEdit } from '@/components/modules/health/AddFoodSheet';
import { MealSuggestionsCard } from '@/components/modules/health/MealSuggestionsCard';
import { EditVitalsSheet } from '@/components/modules/health/EditVitalsSheet';
import { FitDashboard } from '@/components/modules/health/FitDashboard';
import { HealthScreenLegacy } from '@/screens/legacy/HealthScreen.legacy';
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
import { recoveryFromFitDays, computeRecoveryScore, recoveryBandLabel } from '@/utils/recovery';
import { useAI } from '@/hooks/useAI';
import { parseBloodReport } from '@/ai/functions';
import { useGameStore } from '@/store/useGameStore';
import { useFlagStore } from '@/store/useFlagStore';
import { tickQuestMetric } from '@/store/useQuestStore';
import { XP_VALUES } from '@/utils/gamification';
import { useUserStore } from '@/store/useUserStore';
import { useFitSyncStore } from '@/store/useFitSyncStore';
import { logBehaviourEvent } from '@/db/queries/behaviour';
import type { BloodReportResult } from '@/ai/types';
import { isFitConnected, startFitOAuth, clearFitTokens } from '@/integrations/googleFit/oauth';
import { syncAndPersistFit } from '@/integrations/googleFit/sync';

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

// §3.1: `Log a meal` opens the slot the clock says is next — breakfast before
// 11:00, lunch before 16:00, dinner before 21:00, else snack (local device
// time, boundaries exclusive: at exactly 11:00 the answer is lunch).
function mealByTimeOfDay(now: Date): MealType {
  const h = now.getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

// One logged glass of water (§3.1 item 1 — the `+ glass` row action).
const GLASS_ML = 250;
const ENERGY_LEVELS = [1, 2, 3, 4, 5] as const;

// Ink + Signal §3.0.1: the route branches exactly once on module_hierarchy_v1.
// Flag off → the byte-identical legacy tree; flag on → the recomposed
// hero-first tree below. The legacy file is deleted (not edited) when the flag
// graduates — see docs/PARKED_ITEMS.md §13.
export default function HealthScreen() {
  const hierarchyV1 = useFlagStore((s) => s.isEnabled('module_hierarchy_v1'));
  if (!hierarchyV1) return <HealthScreenLegacy />;
  return <HealthScreenV1 />;
}

function HealthScreenV1() {
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
  const [energyPickerOpen, setEnergyPickerOpen] = useState(false);
  const [fitConnected, setFitConnected] = useState(false);
  const [fitSyncing, setFitSyncing] = useState(false);
  const [fitError, setFitError] = useState<string | null>(null);
  // Fit row press target (§3.0.3, amendment x): Sync now + Disconnect live one
  // level in — same pattern as Finance's Gmail sheet. Un-parks 13.2.
  const [fitSheetOpen, setFitSheetOpen] = useState(false);
  const fitDays = useFitSyncStore((s) => s.days);
  const fitWorkouts = useFitSyncStore((s) => s.workouts);
  const clearFitSync = useFitSyncStore((s) => s.clear);
  const { call, loading } = useAI();
  const { userId } = useUserStore();
  const { awardBadge, addXP } = useGameStore();
  const advanceQuest = useGameStore((s) => s.advanceQuest);
  const triggerStreak = useGameStore((s) => s.triggerStreak);
  const streaks = useGameStore((s) => s.streaks);

  // §3.0.6 motion contract: one hero-budget entry per focus, tight stagger on
  // the supporting sections; every duration routes through the motion scale so
  // reduce-motion lands in one frame.
  const motionScale = useMotionScale();
  const stagger = useStaggerDelay();
  const scaled = (base: number) => (motionScale === 0 ? 0 : base / motionScale);

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
      setFitError('Missing EXPO_PUBLIC_GOOGLE_CLIENT_ID — see .env.example.');
      return;
    }
    await startFitOAuth(clientId);
  };

  const handleFitDisconnect = () => {
    clearFitTokens();
    setFitConnected(false);
    clearFitSync();
    setFitError(null);
  };

  const handleFitSync = async () => {
    const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) { setFitError('Missing EXPO_PUBLIC_GOOGLE_CLIENT_ID.'); return; }
    setFitSyncing(true);
    setFitError(null);
    try {
      // Shared with the voice agent's syncGoogleFit tool — one code path persists
      // weight, sleep, recovery, the workout streak, and the cached Fit store.
      const summary = await syncAndPersistFit(clientId, 14);
      if (summary.errors.length > 0) {
        setFitError(`${summary.errors.length} of the synced days failed — try again.`);
      }
      loadData();
    } catch (err) {
      setFitError(err instanceof Error ? err.message : String(err));
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

  // §3.1 hero inputs. hasBaseline gates the populated vs. invitation states.
  const hasBaseline = heightCm != null && trend.latest != null;
  const kcalEaten = Math.round(totals.calories);
  const kcalLeft = targets.calories - kcalEaten;
  const proteinLeftG = Math.max(0, Math.round(targets.protein - totals.protein));
  const totalFitSteps = useMemo(() => fitDays.reduce((s, d) => s + d.steps, 0), [fitDays]);

  const handleSaveVitals = (data: { weightKg?: number; heightCm?: number; age?: number; sex?: string; activityLevel?: string; goalType?: string }) => {
    if (data.weightKg != null) {
      createHealthLog({ date: today, weight: data.weightKg });
      logBehaviourEvent('weight_logged', 'health');
      if (userId) {
        addXP(userId, 10);
        tickQuestMetric(userId, 'weight_logged', 1);
      }
    }
    const profile: { heightCm?: number; age?: number; sex?: string; activityLevel?: string; healthGoalType?: string } = {};
    if (data.heightCm != null) profile.heightCm = data.heightCm;
    if (data.age != null) profile.age = data.age;
    if (data.sex != null) profile.sex = data.sex;
    if (data.activityLevel != null) profile.activityLevel = data.activityLevel;
    if (data.goalType != null) profile.healthGoalType = data.goalType;
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
      tickQuestMetric(userId, 'meals_logged', 1);
      triggerStreak(userId, 'foodTracking');
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

  const handleAddGlass = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    createHealthLog({ date: today, waterMl: GLASS_ML });
    if (userId) tickQuestMetric(userId, 'water_logged', 1);
    loadData();
  };

  const handleLogEnergy = (value: number) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    createHealthLog({ date: today, energyLevel: value });
    setEnergyPickerOpen(false);
    loadData();
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
      <InkCanvas />
      <SafeAreaView style={styles.container}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        {/* R1 block — full-bleed, outside the padded inner container. */}
        <ModuleHeader title="Health" domain="health" color={c.health} />
        <View style={styles.scrollInner}>

        {/* THE hero — the day's energy budget, never a vitals table (§3.1). */}
        <Animated.View
          testID="health-hero"
          entering={FadeInDown.duration(scaled(MOTION_BUDGET.hero))}
        >
          <HealthPulseHero
            kcalLeft={kcalLeft}
            kcalEaten={kcalEaten}
            kcalTarget={targets.calories}
            proteinLeftG={proteinLeftG}
            readiness={{ score: recovery.score, hasData: recovery.hasData, band: recovery.band }}
            hasBaseline={hasBaseline}
            onLogMeal={() => openAddFood(mealByTimeOfDay(new Date()))}
            onAddVitals={() => setShowEditVitals(true)}
          />
        </Animated.View>

        {/* ─── Today — plain hairline rows, no Cards (§3.1 item 1) ─── */}
        <Animated.View
          entering={FadeIn.delay(stagger(0, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
        >
          <SectionTitle>Today</SectionTitle>

          {/* Water always renders — the action produces the first value. */}
          <View style={[styles.row, { borderTopColor: c.border }]}>
            <Body style={styles.rowLabel}>Water</Body>
            <Body style={[styles.rowValue, { color: c.textSecondary }]}>
              {`${waterMl} / ${waterGoalMl} ml`}
            </Body>
            <Pressable
              onPress={handleAddGlass}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Add a glass of water"
            >
              <Body style={[styles.rowAction, { color: c.health }]}>+ glass</Body>
            </Pressable>
          </View>

          {/* Energy: numeral when logged today, otherwise the first-value action. */}
          <View style={[styles.row, { borderTopColor: c.border }]}>
            <Body style={styles.rowLabel}>Energy</Body>
            {energy != null ? (
              <Pressable
                onPress={() => setEnergyPickerOpen((open) => !open)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Energy ${energy} of 5, tap to change`}
              >
                <Body style={[styles.rowValue, { color: c.textSecondary }]}>{`${energy} / 5`}</Body>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setEnergyPickerOpen((open) => !open)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Log energy"
              >
                <Body style={[styles.rowAction, { color: c.health }]}>Log</Body>
              </Pressable>
            )}
          </View>
          {energyPickerOpen && (
            <View style={styles.energyPicker}>
              {ENERGY_LEVELS.map((level) => (
                <Pressable
                  key={level}
                  onPress={() => handleLogEnergy(level)}
                  accessibilityRole="button"
                  accessibilityLabel={`Energy ${level} of 5`}
                  style={[
                    styles.energyPill,
                    { borderColor: c.border },
                    energy === level && { backgroundColor: c.health, borderColor: c.health },
                  ]}
                >
                  <Body style={[styles.rowValue, { color: energy === level ? c.inkOnColor : c.textPrimary }]}>
                    {level}
                  </Body>
                </Pressable>
              ))}
            </View>
          )}

          {/* Readiness — only when a real signal exists. */}
          {recovery.hasData && (
            <View style={[styles.row, { borderTopColor: c.border }]}>
              <Body style={[styles.rowLabel, styles.numeric]}>{`Readiness · ${recovery.score}`}</Body>
              <Body style={[styles.rowValue, { color: c.textSecondary }]}>
                {recoveryBandLabel(recovery.band)}
              </Body>
            </View>
          )}

          {/* Streak rows — n > 0 and gamification on only (zero-suppression). */}
          <HealthStreakRow label="Food log streak" days={streaks.foodTracking.count} />
          <HealthStreakRow label="Workout streak" days={streaks.workout.count} />

          {/* Vitals — one row, hero owns the no-baseline job (§3.1 item 5). */}
          {hasBaseline && (
            <View style={[styles.row, { borderTopColor: c.border }]}>
              <Body style={[styles.rowLabel, styles.numeric]}>
                {`BMI ${summary.bmi} · ${trend.latest} kg · ${heightCm} cm`}
              </Body>
              <Pressable
                onPress={() => setShowEditVitals(true)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Edit vitals"
              >
                <Body style={[styles.rowAction, { color: c.health }]}>Edit</Body>
              </Pressable>
            </View>
          )}
        </Animated.View>

        {/* ─── Calories — pressable headline row + collapsible body (§3.1 item 2) ─── */}
        <Animated.View
          entering={FadeIn.delay(stagger(1, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
        >
          <PressableScale
            onPress={() => toggleSection('calories')}
            accessibilityRole="button"
            accessibilityLabel={`Calories, ${openSection === 'calories' ? 'expanded' : 'collapsed'}`}
            style={styles.sectionHeaderRow}
          >
            <SectionTitle
              trailing={
                <View style={styles.sectionTrailing}>
                  <Caption style={styles.numeric}>
                    {`${kcalEaten} / ${targets.calories} kcal`}
                  </Caption>
                  <Ionicons
                    name={openSection === 'calories' ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={c.textSecondary}
                  />
                </View>
              }
            >
              Calories
            </SectionTitle>
          </PressableScale>

          {openSection === 'calories' && (
            <View style={styles.sectionBody}>
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

              <Caption style={{ color: c.textMuted }}>
                {targets.estimated
                  ? 'Estimated from your vitals — a guide, not medical advice.'
                  : 'Generic estimate. Add your age + vitals to personalise — not medical advice.'}
              </Caption>

              {/* The weight trend lives here — it is a trend, not an answer (§3.1 item 4). */}
              {weightLogs.length > 1 && <WeightChart entries={weightLogs.slice(0, 7)} />}

              {/* Meal groups as rows: name + add action, entries underneath. */}
              <View>
                {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((meal) => (
                  <View key={meal} style={[styles.mealGroup, { borderTopColor: c.border }]}>
                    <View style={styles.mealHeader}>
                      <Body style={styles.rowLabel}>
                        {meal.charAt(0).toUpperCase() + meal.slice(1)}
                      </Body>
                      <Pressable
                        onPress={() => openAddFood(meal)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${meal}`}
                      >
                        <Ionicons name="add-circle-outline" size={22} color={c.health} />
                      </Pressable>
                    </View>
                    {mealGroups[meal].map((entry) => (
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
                    ))}
                  </View>
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
            </View>
          )}
        </Animated.View>

        {/* ─── Blood reports — same pressable-headline treatment (§3.1 item 3) ─── */}
        <Animated.View
          entering={FadeIn.delay(stagger(2, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
        >
          <PressableScale
            onPress={() => toggleSection('blood')}
            accessibilityRole="button"
            accessibilityLabel={`Blood reports, ${openSection === 'blood' ? 'expanded' : 'collapsed'}`}
            style={styles.sectionHeaderRow}
          >
            <SectionTitle
              trailing={
                <Ionicons
                  name={openSection === 'blood' ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={c.textSecondary}
                />
              }
            >
              Blood reports
            </SectionTitle>
          </PressableScale>

          {openSection === 'blood' && (
            <View style={styles.sectionBody}>
              {bloodReportResult ? (
                <BloodReportCard result={bloodReportResult} date={today} />
              ) : (
                <Card style={styles.uploadCard}>
                  {loading ? (
                    <View style={styles.loadingContainer}>
                      <LoadingDots />
                      <Body style={{ color: c.textSecondary }}>Analysing your blood report...</Body>
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
            </View>
          )}
        </Animated.View>

        {/* ─── Connections — always the LAST section (§3.0.3) ─── */}
        <Animated.View
          entering={FadeIn.delay(stagger(3, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
        >
          <SectionTitle>Connections</SectionTitle>
          {fitConnected ? (
            <ConnectRow
              icon="fitness"
              title="Google Fit"
              caption="Steps, sleep, heart rate and weight — synced automatically"
              actionLabel="Sync"
              accent={c.health}
              onPress={() => setFitSheetOpen(true)}
              testID="connect-row-fit"
              status={
                fitDays.length > 0
                  ? `Synced 14d · ${totalFitSteps.toLocaleString()} steps`
                  : undefined
              }
              loading={fitSyncing}
              error={fitError ?? undefined}
            />
          ) : (
            <ConnectRow
              icon="fitness"
              title="Connect Google Fit"
              caption="Steps, sleep, heart rate and weight — synced automatically"
              actionLabel="Connect"
              accent={c.health}
              onPress={handleFitConnect}
              testID="connect-row-fit"
              error={fitError ?? undefined}
            />
          )}
          {fitConnected && fitDays.length > 0 && (
            <FitDashboard days={fitDays} workouts={fitWorkouts} />
          )}
        </Animated.View>
        </View>
      </ScrollView>

      <EditVitalsSheet
        visible={showEditVitals}
        initialWeightKg={trend.latest}
        initialHeightCm={heightCm}
        initialAge={userAge}
        initialSex={sex}
        initialActivityLevel={activityLevel}
        initialGoalType={goalType}
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

      {/* Fit row press target (§3.0.3): Sync now + Disconnect live one level
          in — the row itself never carries a destructive action. */}
      <FitActionsSheet
        visible={fitSheetOpen}
        c={c}
        syncing={fitSyncing}
        onSync={() => {
          setFitSheetOpen(false);
          void handleFitSync();
        }}
        onDisconnect={() => {
          setFitSheetOpen(false);
          handleFitDisconnect();
        }}
        onClose={() => setFitSheetOpen(false)}
      />
      </SafeAreaView>
    </View>
  );
}

// ─── Fit press-target sheet ───────────────────────────────────────────────────

function FitActionsSheet({
  visible,
  c,
  syncing,
  onSync,
  onDisconnect,
  onClose,
}: {
  visible: boolean;
  c: ReturnType<typeof useColors>;
  syncing: boolean;
  onSync: () => void;
  onDisconnect: () => void;
  onClose: () => void;
}) {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[fitSheetStyles.backdrop, { backgroundColor: c.overlay }]} onPress={onClose}>
        <Pressable style={[fitSheetStyles.sheet, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Body style={{ fontFamily: fonts.bodyMedium, color: c.textPrimary }}>Google Fit</Body>
          <Pressable
            onPress={onSync}
            disabled={syncing}
            accessibilityRole="button"
            accessibilityLabel="Sync now"
            style={[fitSheetStyles.actionRow, { borderTopColor: c.border }]}
          >
            <Ionicons name="refresh" size={18} color={c.healthText} />
            <Body style={{ color: c.textPrimary }}>Sync now</Body>
          </Pressable>
          <Pressable
            onPress={onDisconnect}
            accessibilityRole="button"
            accessibilityLabel="Disconnect Google Fit"
            style={[fitSheetStyles.actionRow, { borderTopColor: c.border }]}
          >
            <Ionicons name="log-out-outline" size={18} color={c.error} />
            <Body style={{ color: c.error }}>Disconnect Google Fit</Body>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const fitSheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    padding: spacing.lg,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    borderWidth: 1,
    maxHeight: '70%',
    gap: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  scrollInner: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
  },
  rowValue: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.sm,
    ...TABULAR_NUMS,
  },
  rowAction: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
  },
  numeric: {
    ...TABULAR_NUMS,
  },
  energyPicker: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  energyPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.control,
    borderWidth: 1,
  },
  sectionHeaderRow: {
    minHeight: 56,
    justifyContent: 'center',
  },
  sectionTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionBody: { gap: spacing.md },
  mealGroup: {
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  uploadCard: { gap: spacing.sm },
  uploadDesc: { marginTop: spacing.xs },
  loadingContainer: { alignItems: 'center', paddingVertical: spacing.md, gap: spacing.sm },
});
