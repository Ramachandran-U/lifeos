import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { MOTION_BUDGET, useMotionScale, useStaggerDelay } from '@/theme/motion';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { Button } from '@/components/ui/Button';
import { Button3D } from '@/components/ui/Button3D';
import { Body, Caption } from '@/components/ui/Typography';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { InkCanvas } from '@/components/shared/InkCanvas';
import { SkillGapChart } from '@/components/modules/career/SkillGapChart';
import { LearningResourceCard } from '@/components/modules/career/LearningResourceCard';
import { CareerStrategyView } from '@/components/modules/career/CareerStrategyView';
import { CareerPathHero } from '@/components/modules/career/CareerPathHero';
import { CareerSetupSheet, type CareerSetupSegment } from '@/components/modules/career/CareerSetupSheet';
import { SavePathModal } from '@/components/modules/career/SavePathModal';
import { CareerScreenLegacy } from '@/screens/legacy/CareerScreen.legacy';
import { useScreenTracking } from '@/hooks/useScreenTracking';
import { useAI } from '@/hooks/useAI';
import { analyseSkillGap, generateCareerStrategy } from '@/ai/functions';
import { createGoal } from '@/db/queries/goals';
import { useUserStore } from '@/store/useUserStore';
import { useFlagStore } from '@/store/useFlagStore';
import {
  getAllCareerPaths,
  saveCareerPath,
  deleteCareerPath,
  type SavedCareerPath,
} from '@/db/careerStorage';
import type { SkillGapAnalysis, CareerStrategy } from '@/ai/types';

// Ink + Signal §3.0.1: the route branches exactly once on module_hierarchy_v1.
// Flag off → the byte-identical legacy tree; flag on → the recomposed
// hero-first tree below. The legacy file is deleted (not edited) when the flag
// graduates — see docs/PARKED_ITEMS.md §13.
export default function CareerScreen() {
  const hierarchyV1 = useFlagStore((s) => s.isEnabled('module_hierarchy_v1'));
  if (!hierarchyV1) return <CareerScreenLegacy />;
  return <CareerScreenV1 />;
}

// §3.3 — value before form. The questionnaire lives in CareerSetupSheet and
// the save modal in SavePathModal, so this file carries no inline form at all
// (Dilution trap 2 — enforced by hierarchyGuards at file level).
function CareerScreenV1() {
  useScreenTracking('career');
  const c = useColors();
  const { call, loading, error } = useAI();

  // Path state (shared by the hero, the sheet, and save/load)
  const [currentRole, setCurrentRole] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [timelineMonths, setTimelineMonths] = useState(24);
  const [skills, setSkills] = useState<string[]>([]);

  // Strategy inputs (second sheet segment)
  const [timeframeWeeks, setTimeframeWeeks] = useState(12);
  const [weeklyHours, setWeeklyHours] = useState(10);
  const [constraints, setConstraints] = useState('');

  // Results
  const [analysis, setAnalysis] = useState<SkillGapAnalysis | null>(null);
  const [strategy, setStrategy] = useState<CareerStrategy | null>(null);
  const [acceptedStepIds, setAcceptedStepIds] = useState<Set<string>>(new Set());
  const userId = useUserStore((s) => s.userId);

  // Saved paths
  const [savedPaths, setSavedPaths] = useState<SavedCareerPath[]>([]);

  // Sheet + save modal
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSegment, setSheetSegment] = useState<CareerSetupSegment>('setup');
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [saveName, setSaveName] = useState('');

  // §3.0.6 motion contract: one hero-budget entry per state change, tight
  // stagger on the supporting cast, reduce-motion lands in one frame.
  const motionScale = useMotionScale();
  const stagger = useStaggerDelay();
  const scaled = (base: number) => (motionScale === 0 ? 0 : base / motionScale);

  useFocusEffect(
    useCallback(() => {
      setSavedPaths(getAllCareerPaths());
    }, []),
  );

  // Voice-agent deep link: prefill the setup from the spoken inputs and, when
  // autorun, run the existing analyse → strategy flow (with the screen's own
  // loading UI). Runs once; params are consumed so re-focus is inert.
  const router = useRouter();
  const params = useLocalSearchParams<{
    currentRole?: string; targetRole?: string; timelineMonths?: string;
    weeklyHours?: string; constraints?: string; autorun?: string;
  }>();
  const ranVoiceParams = useRef(false);
  useEffect(() => {
    if (ranVoiceParams.current) return;
    const one = (x: string | string[] | undefined) => (Array.isArray(x) ? x[0] : x) ?? '';
    const cr = one(params.currentRole).trim();
    const tr = one(params.targetRole).trim();
    if (!cr || !tr) return;
    ranVoiceParams.current = true;
    const months = Number(one(params.timelineMonths)) || 24;
    const hoursRaw = Number(one(params.weeklyHours));
    const hours = hoursRaw > 0 ? hoursRaw : 10;
    const cons = one(params.constraints).trim();
    setCurrentRole(cr);
    setTargetRole(tr);
    setTimelineMonths(months);
    if (hoursRaw > 0) setWeeklyHours(hours);
    if (cons) setConstraints(cons);
    router.setParams({ currentRole: '', targetRole: '', timelineMonths: '', weeklyHours: '', constraints: '', autorun: '' });
    if (one(params.autorun) === '1') {
      void (async () => {
        const a = await call(() =>
          analyseSkillGap({ currentRole: cr, targetRole: tr, timelineMonths: months, currentSkills: [] }),
        );
        if (a) setAnalysis(a);
        const st = await call(() =>
          generateCareerStrategy({
            currentRole: cr, targetRole: tr, currentSkills: [],
            timeframeWeeks, weeklyHours: hours, constraints: cons || undefined,
          }),
        );
        if (st) { setStrategy(st); setAcceptedStepIds(new Set()); }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.currentRole, params.targetRole]);

  // Hero state B input: the most recent saved path.
  const latestSavedPath = useMemo(
    () =>
      savedPaths.reduce<SavedCareerPath | null>(
        (latest, p) => (latest == null || p.savedAt > latest.savedAt ? p : latest),
        null,
      ),
    [savedPaths],
  );

  // ── Skill tag helpers (committed list lives here; the sheet owns the input) ──

  const addSkill = (skill: string) => {
    setSkills((prev) => (prev.includes(skill) ? prev : [...prev, skill]));
  };

  const removeSkill = (s: string) => setSkills((prev) => prev.filter((x) => x !== s));

  // ── Sheet triggers ──────────────────────────────────────────────────────────

  const openSetupSheet = () => {
    setSheetSegment('setup');
    setSheetOpen(true);
  };

  const openStrategySheet = () => {
    setSheetSegment('strategy');
    setSheetOpen(true);
  };

  // ── Analyse ────────────────────────────────────────────────────────────────

  const handleAnalyse = async () => {
    if (!currentRole.trim() || !targetRole.trim()) return;
    const result = await call(() =>
      analyseSkillGap({ currentRole, targetRole, timelineMonths, currentSkills: skills }),
    );
    if (result) {
      setAnalysis(result);
      // §3.3: close the sheet on success — the results hero enters behind it.
      setSheetOpen(false);
    }
  };

  // ── Career Strategy ─────────────────────────────────────────────────────

  const handleGenerateStrategy = async () => {
    if (!currentRole.trim() || !targetRole.trim()) return;
    const result = await call(() =>
      generateCareerStrategy({
        currentRole,
        targetRole,
        currentSkills: skills,
        timeframeWeeks,
        weeklyHours,
        constraints: constraints.trim() || undefined,
      }),
    );
    if (result) {
      setStrategy(result);
      setAcceptedStepIds(new Set());
      setSheetOpen(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const acceptWeek = (weekIndex: number) => {
    if (!strategy || !userId) return;
    const w = strategy.weeklyOutput[weekIndex];
    if (!w) return;
    createGoal({
      userId,
      title: `W${w.week}: ${w.artifact}`,
      description: w.description,
      goalType: 'learning',
      level: 'weekly',
      aiGenerated: true,
      metadata: JSON.stringify({
        source: 'career_strategy',
        kind: 'weekly_output',
        week: w.week,
        targetRole,
      }),
    });
    setAcceptedStepIds((prev) => new Set(prev).add(`week:${weekIndex}`));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const acceptDaily = (slot: 'deepWork' | 'build' | 'review', itemIndex: number) => {
    if (!strategy || !userId) return;
    const item = strategy.dailyPlan[slot][itemIndex];
    if (!item) return;
    const slotLabel = slot === 'deepWork' ? 'Deep Work' : slot === 'build' ? 'Build' : 'Review';
    createGoal({
      userId,
      title: `[${slotLabel}] ${item}`,
      description: `Daily ${slotLabel.toLowerCase()} slot from your career strategy for ${targetRole}.`,
      goalType: 'learning',
      level: 'daily',
      aiGenerated: true,
      metadata: JSON.stringify({
        source: 'career_strategy',
        kind: 'daily_plan',
        slot,
        targetRole,
      }),
    });
    setAcceptedStepIds((prev) => new Set(prev).add(`daily:${slot}:${itemIndex}`));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const acceptAllStrategy = () => {
    if (!strategy || !userId) return;
    strategy.weeklyOutput.forEach((_, i) => {
      if (!acceptedStepIds.has(`week:${i}`)) acceptWeek(i);
    });
    (['deepWork', 'build', 'review'] as const).forEach((slot) => {
      strategy.dailyPlan[slot].forEach((_, i) => {
        if (!acceptedStepIds.has(`daily:${slot}:${i}`)) acceptDaily(slot, i);
      });
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ── Save path ──────────────────────────────────────────────────────────────

  const openSaveModal = () => {
    setSaveName(`${currentRole} → ${targetRole}`);
    setSaveModalVisible(true);
  };

  const confirmSave = () => {
    if (!analysis || !saveName.trim()) return;
    saveCareerPath({
      name: saveName.trim(),
      currentRole,
      targetRole,
      timelineMonths,
      currentSkills: skills,
      analysis,
    });
    setSavedPaths(getAllCareerPaths());
    setSaveModalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ── Load saved path ────────────────────────────────────────────────────────

  const loadPath = (path: SavedCareerPath) => {
    setCurrentRole(path.currentRole);
    setTargetRole(path.targetRole);
    setTimelineMonths(path.timelineMonths);
    setSkills(path.currentSkills);
    setAnalysis(path.analysis);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // ── Delete saved path ──────────────────────────────────────────────────────

  const handleDelete = (id: string) => {
    deleteCareerPath(id);
    setSavedPaths(getAllCareerPaths());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  // ── Clear / start fresh ────────────────────────────────────────────────────

  const handleClear = () => {
    setCurrentRole('');
    setTargetRole('');
    setTimelineMonths(24);
    setSkills([]);
    setAnalysis(null);
    setStrategy(null);
    setAcceptedStepIds(new Set());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // The hero re-enters (one hero-budget entry) when its data state changes —
  // e.g. the sheet closes on a successful analysis and state C arrives.
  const heroState = analysis ? 'loaded' : latestSavedPath ? 'saved' : 'zero';

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <InkCanvas />
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* R1 block — full-bleed, outside the padded inner container. */}
          <ModuleHeader title="Career" domain="career" color={c.career} />
          <View style={styles.scrollInner}>
            {/* THE hero — value in all three data states; the form never renders here (§3.3). */}
            <Animated.View
              key={heroState}
              testID="career-hero"
              entering={FadeInDown.duration(scaled(MOTION_BUDGET.hero))}
            >
              <CareerPathHero
                currentRole={currentRole}
                targetRole={targetRole}
                analysis={analysis}
                latestSavedPath={latestSavedPath}
                onMapPath={openSetupSheet}
                onResumePath={loadPath}
                onStartNew={openSetupSheet}
              />
            </Animated.View>

            {/* ─── Supporting cast — state C only (§3.3 items 2–6) ─── */}
            {analysis && (
              <>
                <Animated.View
                  entering={FadeIn.delay(stagger(0, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
                >
                  <SectionTitle
                    trailing={
                      <Pressable
                        onPress={openSetupSheet}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Edit path"
                      >
                        <Body style={[styles.textAction, { color: c.career }]}>Edit path</Body>
                      </Pressable>
                    }
                  >
                    Skill gaps
                  </SectionTitle>
                  <SkillGapChart gaps={analysis.gaps} />
                </Animated.View>

                <Animated.View
                  entering={FadeIn.delay(stagger(1, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
                >
                  <SectionTitle>Learning path</SectionTitle>
                  {analysis.resources.map((resource, i) => (
                    <LearningResourceCard
                      key={i}
                      title={resource.title}
                      type={resource.type}
                      estimatedHours={resource.estimatedHours}
                      status="not_started"
                    />
                  ))}
                </Animated.View>

                <Animated.View
                  entering={FadeIn.delay(stagger(2, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
                >
                  <SectionTitle>12-week plan</SectionTitle>
                  {strategy ? (
                    <CareerStrategyView
                      strategy={strategy}
                      acceptedIds={acceptedStepIds}
                      onAcceptWeek={acceptWeek}
                      onAcceptDaily={acceptDaily}
                      onAcceptAll={acceptAllStrategy}
                    />
                  ) : (
                    <View style={[styles.row, { borderTopColor: c.border }]}>
                      <Body style={styles.rowLabel}>Turn this into weekly artifacts</Body>
                      <Pressable
                        onPress={openStrategySheet}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Generate plan"
                      >
                        <Body style={[styles.textAction, { color: c.career }]}>Generate plan</Body>
                      </Pressable>
                    </View>
                  )}
                </Animated.View>

                <Animated.View
                  entering={FadeIn.delay(stagger(3, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
                  style={styles.actionRow}
                >
                  <Button3D title="Save path" tone="career" onPress={openSaveModal} style={styles.actionBtn} />
                  <Button title="Clear" variant="danger" onPress={handleClear} style={styles.actionBtn} />
                </Animated.View>

                {savedPaths.length > 0 && (
                  <Animated.View
                    entering={FadeIn.delay(stagger(4, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
                  >
                    <SectionTitle count={savedPaths.length}>Saved paths</SectionTitle>
                    {savedPaths.map((path) => (
                      <View key={path.id} style={[styles.savedRow, { borderTopColor: c.border }]}>
                        <View style={styles.savedInfo}>
                          <Body style={[styles.savedName, { color: c.textPrimary }]}>
                            {path.name}
                          </Body>
                          <Caption style={{ color: c.textMuted }}>
                            {path.currentRole} → {path.targetRole} · {path.timelineMonths / 12}yr ·{' '}
                            {new Date(path.savedAt).toLocaleDateString()}
                          </Caption>
                        </View>
                        <Pressable
                          onPress={() => loadPath(path)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Load ${path.name}`}
                        >
                          <Ionicons name="folder-open-outline" size={18} color={c.careerText} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleDelete(path.id)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete ${path.name}`}
                        >
                          <Ionicons name="trash-outline" size={18} color={c.error} />
                        </Pressable>
                      </View>
                    ))}
                  </Animated.View>
                )}
              </>
            )}
            {/* No Connections section on Career — no integration exists (§3.3). */}
          </View>
        </ScrollView>

        <CareerSetupSheet
          visible={sheetOpen}
          segment={sheetSegment}
          currentRole={currentRole}
          targetRole={targetRole}
          timelineMonths={timelineMonths}
          skills={skills}
          timeframeWeeks={timeframeWeeks}
          weeklyHours={weeklyHours}
          constraints={constraints}
          loading={loading}
          error={error}
          onChangeCurrentRole={setCurrentRole}
          onChangeTargetRole={setTargetRole}
          onChangeTimelineMonths={setTimelineMonths}
          onAddSkill={addSkill}
          onRemoveSkill={removeSkill}
          onChangeTimeframeWeeks={setTimeframeWeeks}
          onChangeWeeklyHours={setWeeklyHours}
          onChangeConstraints={setConstraints}
          onAnalyse={handleAnalyse}
          onGenerateStrategy={handleGenerateStrategy}
          onClose={() => setSheetOpen(false)}
        />

        <SavePathModal
          visible={saveModalVisible}
          saveName={saveName}
          onChangeSaveName={setSaveName}
          onClose={() => setSaveModalVisible(false)}
          onConfirm={confirmSave}
        />
      </SafeAreaView>
    </View>
  );
}

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
  textAction: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  actionBtn: { flex: 1 },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  savedInfo: { flex: 1, gap: 2 },
  savedName: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.md,
  },
});
