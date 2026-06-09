import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { RotatingPlaceholder } from '@/components/ui/RotatingPlaceholder';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Body, Label, Caption, Heading } from '@/components/ui/Typography';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { SkillGapChart } from '@/components/modules/career/SkillGapChart';
import { LearningResourceCard } from '@/components/modules/career/LearningResourceCard';
import { useScreenTracking } from '@/hooks/useScreenTracking';
import { CareerStrategyView } from '@/components/modules/career/CareerStrategyView';
import { MotivationBanner } from '@/components/shared/MotivationBanner';
import { useAI } from '@/hooks/useAI';
import { analyseSkillGap, generateCareerStrategy } from '@/ai/functions';
import { createGoal } from '@/db/queries/goals';
import { useUserStore } from '@/store/useUserStore';
import {
  getAllCareerPaths,
  saveCareerPath,
  deleteCareerPath,
  type SavedCareerPath,
} from '@/db/careerStorage';
import type { SkillGapAnalysis, CareerStrategy } from '@/ai/types';

// Rotating prompts for the career setup inputs (cross-fade while empty).
const CURRENT_ROLE_PLACEHOLDERS = [
  'e.g. Software Engineer',
  'e.g. Product Designer',
  'e.g. Data Analyst',
  'Where are you now?',
];
const TARGET_ROLE_PLACEHOLDERS = [
  'e.g. Engineering Manager',
  'e.g. Staff Engineer',
  'e.g. Head of Design',
  'Where do you want to be?',
];
const SKILL_PLACEHOLDERS = [
  'e.g. TypeScript',
  'e.g. System design',
  'e.g. Public speaking',
  'Add a skill you already have…',
];

const TIMELINE_OPTIONS = [
  { label: '1 yr',  months: 12  },
  { label: '2 yrs', months: 24  },
  { label: '3 yrs', months: 36  },
  { label: '5 yrs', months: 60  },
];

const STRATEGY_TIMEFRAMES = [
  { label: '8 wk', weeks: 8 },
  { label: '12 wk', weeks: 12 },
  { label: '24 wk', weeks: 24 },
  { label: '52 wk', weeks: 52 },
];

const HOURS_OPTIONS = [5, 10, 15, 20];

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CareerScreen() {
  useScreenTracking('career');
  const c = useColors();
  const { call, loading, error } = useAI();

  // Setup form state
  const [currentRole,      setCurrentRole]      = useState('');
  const [targetRole,       setTargetRole]        = useState('');
  const [timelineMonths,   setTimelineMonths]    = useState(24);
  const [skillInput,       setSkillInput]        = useState('');
  const [skills,           setSkills]            = useState<string[]>([]);

  // Strategy inputs
  const [timeframeWeeks, setTimeframeWeeks] = useState(12);
  const [weeklyHours, setWeeklyHours] = useState(10);
  const [constraints, setConstraints] = useState('');

  // Results
  const [analysis, setAnalysis] = useState<SkillGapAnalysis | null>(null);
  const [strategy, setStrategy] = useState<CareerStrategy | null>(null);
  const [acceptedStepIds, setAcceptedStepIds] = useState<Set<string>>(new Set());
  const userId = useUserStore((s) => s.userId);

  // Saved paths
  const [savedPaths,   setSavedPaths]   = useState<SavedCareerPath[]>([]);
  const [showSaved,    setShowSaved]    = useState(false);

  // Save-path modal
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [saveName,         setSaveName]         = useState('');

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      setSavedPaths(getAllCareerPaths());
    }, []),
  );

  // ── Skill tag helpers ──────────────────────────────────────────────────────

  const addSkill = () => {
    const t = skillInput.trim();
    if (t && !skills.includes(t)) setSkills((prev) => [...prev, t]);
    setSkillInput('');
  };

  const removeSkill = (s: string) => setSkills((prev) => prev.filter((x) => x !== s));

  // ── Analyse ────────────────────────────────────────────────────────────────

  const handleAnalyse = async () => {
    if (!currentRole.trim() || !targetRole.trim()) return;
    const result = await call(() =>
      analyseSkillGap({ currentRole, targetRole, timelineMonths, currentSkills: skills }),
    );
    if (result) setAnalysis(result);
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const getNextPriority = (): number => Date.now(); // lower value = higher priority in sort asc

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
    setShowSaved(false);
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
    setSkillInput('');
    setAnalysis(null);
    setStrategy(null);
    setAcceptedStepIds(new Set());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const s = makeStyles(c);

  // ── Render: setup form ─────────────────────────────────────────────────────

  const renderSetup = () => (
    <Animated.View entering={FadeInDown.duration(400)} style={s.section}>
      <Card style={s.setupCard}>
        <Label style={{ color: c.career }}>NEW CAREER PATH</Label>
        <Heading style={[s.setupHeading, { color: c.textPrimary }]}>
          Where are you going?
        </Heading>

        <View style={s.formGap}>
          <Input
            label="Current role"
            accessibilityLabel="Current role"
            rotatingPlaceholders={CURRENT_ROLE_PLACEHOLDERS}
            value={currentRole}
            onChangeText={setCurrentRole}
          />

          <Input
            label="Target role"
            accessibilityLabel="Target role"
            rotatingPlaceholders={TARGET_ROLE_PLACEHOLDERS}
            value={targetRole}
            onChangeText={setTargetRole}
          />

          <View>
            <Label style={s.fieldLabel}>Timeline</Label>
            <View style={s.timelineRow}>
              {TIMELINE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.months}
                  style={[
                    s.timelinePill,
                    { borderColor: c.border },
                    timelineMonths === opt.months && { backgroundColor: c.career, borderColor: c.career },
                  ]}
                  onPress={() => setTimelineMonths(opt.months)}
                >
                  <Caption
                    style={[
                      s.timelineLabel,
                      { color: timelineMonths === opt.months ? '#FFF' : c.textSecondary },
                    ]}
                  >
                    {opt.label}
                  </Caption>
                </Pressable>
              ))}
            </View>
          </View>

          <View>
            <Label style={s.fieldLabel}>Your current skills</Label>
            <View style={s.skillInputRow}>
              <View style={s.skillInputWrap}>
                <TextInput
                  style={[s.skillTextInput, s.skillInputFlush, { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary }]}
                  accessibilityLabel="Current skills"
                  placeholderTextColor={c.textMuted}
                  value={skillInput}
                  onChangeText={setSkillInput}
                  onSubmitEditing={addSkill}
                  returnKeyType="done"
                />
                <RotatingPlaceholder
                  phrases={SKILL_PLACEHOLDERS}
                  active={!skillInput}
                  color={c.textMuted}
                  style={s.skillRotating}
                />
              </View>
              <Pressable style={[s.addBtn, { backgroundColor: c.career }]} onPress={addSkill}>
                <Ionicons name="add" size={20} color="#FFF" />
              </Pressable>
            </View>
            {skills.length > 0 && (
              <View style={s.skillsRow}>
                {skills.map((sk) => (
                  <Pressable key={sk} onPress={() => removeSkill(sk)}>
                    <Badge label={`${sk} ×`} variant="career" />
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <Button
            title="Analyse my career path"
            onPress={handleAnalyse}
            disabled={!currentRole.trim() || !targetRole.trim() || loading}
          />
          {error && (
            <Caption style={{ color: c.error, marginTop: spacing.sm }}>
              {/^\s*\[?\s*\{/.test(error)
                ? "We couldn't read the AI's response. Try again or tweak the inputs."
                : error}
            </Caption>
          )}
        </View>
      </Card>

      {/* Saved paths list inside setup */}
      {savedPaths.length > 0 && renderSavedPathsList()}
    </Animated.View>
  );

  // ── Render: results view ───────────────────────────────────────────────────

  const renderResults = () => (
    <>
      {/* Motivation banner */}
      <MotivationBanner
        module="career"
        context={`moving from ${currentRole} to ${targetRole}`}
        accent={c.career}
      />

      {/* Path card */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <Card moduleColor={c.career} style={s.targetCard}>
          <Label color={c.career}>YOUR PATH</Label>
          <Heading style={[s.pathTitle, { color: c.textPrimary }]}>
            {currentRole} → {targetRole}
          </Heading>
          {(() => {
            // Real progress from the skill-gap analysis: how far current levels
            // are toward required levels, aggregated across gaps. Replaces a
            // hardcoded 15% placeholder that showed every user the same fake number.
            const LEVEL_VALUE: Record<string, number> = { none: 0, beginner: 25, intermediate: 50, advanced: 75, expert: 100 };
            const gaps = analysis?.gaps ?? [];
            const have = gaps.reduce((sum, g) => sum + (LEVEL_VALUE[g.currentLevel] ?? 0), 0);
            const need = gaps.reduce((sum, g) => sum + (LEVEL_VALUE[g.requiredLevel] ?? 100), 0);
            const pct = need > 0 ? Math.round((have / need) * 100) : 0;
            return (
              <>
                <ProgressBar value={pct} color={c.career} />
                <Caption style={{ color: c.textSecondary }}>
                  {gaps.length > 0 ? `${pct}% of the way there` : 'Add your current skills to track progress'}
                </Caption>
              </>
            );
          })()}
        </Card>
      </Animated.View>

      {/* Skill gaps */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <Body style={[s.sectionTitle, { color: c.textPrimary }]}>Skill Gaps</Body>
        <SkillGapChart gaps={analysis!.gaps} />
      </Animated.View>

      {/* Learning path */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <Body style={[s.sectionTitle, { color: c.textPrimary }]}>Learning Path</Body>
        {analysis!.resources.map((resource, i) => (
          <LearningResourceCard
            key={i}
            title={resource.title}
            type={resource.type}
            estimatedHours={resource.estimatedHours}
            status="not_started"
          />
        ))}
      </Animated.View>

      {/* Elite Career Strategist */}
      <Animated.View entering={FadeInDown.delay(250).duration(400)} style={s.section}>
        {!strategy ? (
          <Card style={s.setupCard}>
            <Label color={c.career}>ELITE STRATEGIST</Label>
            <Caption style={{ color: c.textSecondary }}>
              Generate a no-fluff execution plan: Reality Check, 12-week phases, daily + weekly artifacts.
            </Caption>

            <View>
              <Label style={s.fieldLabel}>Timeframe</Label>
              <View style={s.timelineRow}>
                {STRATEGY_TIMEFRAMES.map((opt) => (
                  <Pressable
                    key={opt.weeks}
                    style={[
                      s.timelinePill,
                      { borderColor: c.border },
                      timeframeWeeks === opt.weeks && { backgroundColor: c.career, borderColor: c.career },
                    ]}
                    onPress={() => setTimeframeWeeks(opt.weeks)}
                  >
                    <Caption style={[s.timelineLabel, { color: timeframeWeeks === opt.weeks ? '#FFF' : c.textSecondary }]}>
                      {opt.label}
                    </Caption>
                  </Pressable>
                ))}
              </View>
            </View>

            <View>
              <Label style={s.fieldLabel}>Weekly hours</Label>
              <View style={s.timelineRow}>
                {HOURS_OPTIONS.map((h) => (
                  <Pressable
                    key={h}
                    style={[
                      s.timelinePill,
                      { borderColor: c.border },
                      weeklyHours === h && { backgroundColor: c.career, borderColor: c.career },
                    ]}
                    onPress={() => setWeeklyHours(h)}
                  >
                    <Caption style={[s.timelineLabel, { color: weeklyHours === h ? '#FFF' : c.textSecondary }]}>
                      {h}h
                    </Caption>
                  </Pressable>
                ))}
              </View>
            </View>

            <View>
              <Label style={s.fieldLabel}>Constraints (optional)</Label>
              <TextInput
                style={[s.skillTextInput, { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary }]}
                placeholder="e.g. full-time job, toddler at home"
                placeholderTextColor={c.textMuted}
                value={constraints}
                onChangeText={setConstraints}
              />
            </View>

            <Button
              title="Generate strategy"
              loadingTitle="Designing strategy…"
              loading={loading}
              onPress={handleGenerateStrategy}
            />
          </Card>
        ) : (
          <CareerStrategyView
            strategy={strategy}
            acceptedIds={acceptedStepIds}
            onAcceptWeek={acceptWeek}
            onAcceptDaily={acceptDaily}
            onAcceptAll={acceptAllStrategy}
          />
        )}
      </Animated.View>

      {/* Action buttons */}
      <Animated.View entering={FadeInDown.delay(300).duration(400)} style={s.actionRow}>
        <Button
          title="Save path"
          onPress={openSaveModal}
          style={s.actionBtn}
        />
        <Button
          title="Clear"
          variant="danger"
          onPress={handleClear}
          style={s.actionBtn}
        />
      </Animated.View>

      {/* Saved paths */}
      {savedPaths.length > 0 && (
        <Animated.View entering={FadeInDown.delay(350).duration(400)}>
          <Pressable
            style={s.savedToggle}
            onPress={() => setShowSaved((v) => !v)}
          >
            <Body style={[s.sectionTitle, { color: c.textPrimary, marginTop: 0 }]}>
              Saved Paths ({savedPaths.length})
            </Body>
            <Ionicons
              name={showSaved ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={c.textSecondary}
            />
          </Pressable>
          {showSaved && renderSavedPathsList()}
        </Animated.View>
      )}
    </>
  );

  // ── Render: saved paths list ───────────────────────────────────────────────

  const renderSavedPathsList = () => (
    <View style={s.savedList}>
      {savedPaths.length === 0 && (
        <Caption style={{ color: c.textMuted, textAlign: 'center' }}>No saved paths yet.</Caption>
      )}
      {savedPaths.map((path) => (
        <Animated.View key={path.id} entering={FadeIn.duration(300)}>
          <Card style={s.savedCard}>
            <View style={s.savedCardHeader}>
              <View style={s.savedCardInfo}>
                <Body style={[s.savedCardName, { color: c.textPrimary }]}>{path.name}</Body>
                <Caption style={{ color: c.textMuted }}>
                  {path.currentRole} → {path.targetRole} · {path.timelineMonths / 12}yr
                </Caption>
                <Caption style={{ color: c.textMuted }}>
                  {new Date(path.savedAt).toLocaleDateString()}
                </Caption>
              </View>
              <View style={s.savedCardActions}>
                <Pressable
                  style={[s.iconBtn, { backgroundColor: c.careerLight ?? c.primaryLight }]}
                  onPress={() => loadPath(path)}
                  hitSlop={8}
                >
                  <Ionicons name="folder-open-outline" size={16} color={c.career} />
                </Pressable>
                <Pressable
                  style={[s.iconBtn, { backgroundColor: '#FF444422' }]}
                  onPress={() => handleDelete(path.id)}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={16} color={c.error} />
                </Pressable>
              </View>
            </View>
          </Card>
        </Animated.View>
      ))}
    </View>
  );

  // ── Render: save modal ─────────────────────────────────────────────────────

  const renderSaveModal = () => (
    <Modal
      visible={saveModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setSaveModalVisible(false)}
    >
      <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setSaveModalVisible(false)} />
        <Animated.View entering={FadeInDown.duration(250)} style={[s.modalBox, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Body style={[s.modalTitle, { color: c.textPrimary }]}>Save career path</Body>
          <Caption style={{ color: c.textMuted, marginBottom: spacing.md }}>
            Give this path a name so you can load it later.
          </Caption>

          <TextInput
            style={[s.modalInput, { backgroundColor: c.background, borderColor: c.border, color: c.textPrimary }]}
            placeholder="e.g. My PM journey"
            placeholderTextColor={c.textMuted}
            value={saveName}
            onChangeText={setSaveName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={confirmSave}
          />

          <View style={s.modalButtons}>
            <Pressable
              style={[s.modalBtn, { borderColor: c.border, borderWidth: 1 }]}
              onPress={() => setSaveModalVisible(false)}
            >
              <Body style={{ color: c.textSecondary }}>Cancel</Body>
            </Pressable>
            <Pressable
              style={[s.modalBtn, { backgroundColor: c.career }]}
              onPress={confirmSave}
              disabled={!saveName.trim()}
            >
              <Body style={{ color: '#FFF', fontFamily: fonts.heading }}>Save</Body>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // ── Root render ────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <AuroraBackground />
      <SafeAreaView style={s.container}>
      <ScrollView style={s.flex} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <ModuleHeader title="Career" domain="career" color={c.career} />

        {loading && !analysis && (
          <View style={s.loadingContainer}>
            <LoadingDots />
            <Body style={{ color: c.textSecondary }}>Analysing your career path…</Body>
          </View>
        )}

        {!analysis && !loading && renderSetup()}
        {analysis && renderResults()}
      </ScrollView>

      {renderSaveModal()}
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    flex: { flex: 1 },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
      gap: spacing.md,
    },

    // Setup
    setupCard:    { gap: spacing.md },
    setupHeading: { fontSize: fontSizes.xl, marginTop: spacing.xs },
    formGap:      { gap: spacing.md },
    fieldLabel:   { marginBottom: spacing.xs, color: c.textSecondary },
    timelineRow:  { flexDirection: 'row', gap: spacing.sm },
    timelinePill: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
    },
    timelineLabel: { fontSize: fontSizes.sm, fontFamily: fonts.bodyMedium },
    skillInputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    skillInputWrap: { flex: 1, position: 'relative', justifyContent: 'center' },
    // Inside skillInputWrap the flex:1 moves to the wrapper, so the field fills width.
    skillInputFlush: { flex: 0, width: '100%' },
    // Aligns the cross-fading overlay with the field's text (paddingHorizontal md, paddingVertical 12).
    skillRotating: { left: spacing.md, top: 12, fontSize: fontSizes.md },
    skillTextInput: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      fontFamily: fonts.body,
      fontSize: fontSizes.md,
    },
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },

    // Results
    section: { gap: spacing.md },
    targetCard: { gap: spacing.sm },
    pathTitle:  { fontSize: fontSizes.xl },
    sectionTitle: {
      fontFamily: fonts.heading,
      fontSize: fontSizes.lg,
      marginTop: spacing.sm,
    },
    actionRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    actionBtn: { flex: 1 },

    // Saved paths
    savedToggle: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    savedList:   { gap: spacing.sm, marginTop: spacing.xs },
    savedCard:   { padding: spacing.md },
    savedCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    savedCardInfo:    { flex: 1, gap: 2 },
    savedCardName:    { fontFamily: fonts.heading, fontSize: fontSizes.md },
    savedCardActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Loading
    loadingContainer: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
      gap: spacing.sm,
    },

    // Modal
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)',
      padding: spacing.xl,
    },
    modalBox: {
      width: '100%',
      maxWidth: 400,
      borderRadius: 20,
      borderWidth: 1,
      padding: spacing.xl,
      gap: spacing.sm,
    },
    modalTitle: {
      fontFamily: fonts.heading,
      fontSize: fontSizes.lg,
    },
    modalInput: {
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
      fontFamily: fonts.body,
      fontSize: fontSizes.md,
      marginBottom: spacing.sm,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    modalBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
