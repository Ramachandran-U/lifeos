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
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Body, Label, Caption, Heading } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { SkillGapChart } from '@/components/modules/career/SkillGapChart';
import { LearningResourceCard } from '@/components/modules/career/LearningResourceCard';
import { useAI } from '@/hooks/useAI';
import { analyseSkillGap } from '@/ai/functions';
import {
  getAllCareerPaths,
  saveCareerPath,
  deleteCareerPath,
  type SavedCareerPath,
} from '@/db/careerStorage';
import type { SkillGapAnalysis } from '@/ai/types';

const TIMELINE_OPTIONS = [
  { label: '1 yr',  months: 12  },
  { label: '2 yrs', months: 24  },
  { label: '3 yrs', months: 36  },
  { label: '5 yrs', months: 60  },
];

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CareerScreen() {
  const c = useColors();
  const { call, loading } = useAI();

  // Setup form state
  const [currentRole,      setCurrentRole]      = useState('');
  const [targetRole,       setTargetRole]        = useState('');
  const [timelineMonths,   setTimelineMonths]    = useState(24);
  const [skillInput,       setSkillInput]        = useState('');
  const [skills,           setSkills]            = useState<string[]>([]);

  // Results
  const [analysis, setAnalysis] = useState<SkillGapAnalysis | null>(null);

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
            placeholder="e.g. Software Engineer"
            value={currentRole}
            onChangeText={setCurrentRole}
          />

          <Input
            label="Target role"
            placeholder="e.g. Engineering Manager"
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
              <TextInput
                style={[s.skillTextInput, { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary }]}
                placeholder="e.g. JavaScript"
                placeholderTextColor={c.textMuted}
                value={skillInput}
                onChangeText={setSkillInput}
                onSubmitEditing={addSkill}
                returnKeyType="done"
              />
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
        </View>
      </Card>

      {/* Saved paths list inside setup */}
      {savedPaths.length > 0 && renderSavedPathsList()}
    </Animated.View>
  );

  // ── Render: results view ───────────────────────────────────────────────────

  const renderResults = () => (
    <>
      {/* Path card */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <Card moduleColor={c.career} style={s.targetCard}>
          <Label color={c.career}>YOUR PATH</Label>
          <Heading style={[s.pathTitle, { color: c.textPrimary }]}>
            {currentRole} → {targetRole}
          </Heading>
          <ProgressBar value={15} color={c.career} />
          <Caption style={{ color: c.textSecondary }}>15% of the way there</Caption>
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
      <KeyboardAvoidingView
        style={s.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setSaveModalVisible(false)} />
        <Animated.View entering={FadeInDown.duration(250)} style={[s.modalBox, { backgroundColor: c.card, borderColor: c.border }]}>
          <Body style={[s.modalTitle, { color: c.textPrimary }]}>Save career path</Body>
          <Caption style={{ color: c.textMuted, marginBottom: spacing.md }}>
            Give this path a name so you can load it later.
          </Caption>

          <TextInput
            style={[s.modalInput, { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary }]}
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
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <ScrollView style={s.flex} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <ModuleHeader title="Career" icon="briefcase" color={c.career} />

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
