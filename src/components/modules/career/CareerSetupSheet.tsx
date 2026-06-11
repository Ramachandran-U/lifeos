import { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { Input } from '@/components/ui/Input';
import { RotatingPlaceholder } from '@/components/ui/RotatingPlaceholder';
import { Badge } from '@/components/ui/Badge';
import { Button3D } from '@/components/ui/Button3D';
import { Body, Label, Caption, Heading } from '@/components/ui/Typography';

// Rotating prompts for the career setup inputs (cross-fade while empty) —
// moved verbatim from the legacy screen with the form (Ink + Signal §3.3).
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

export type CareerSetupSegment = 'setup' | 'strategy';

interface CareerSetupSheetProps {
  visible: boolean;
  /** 'setup' = role/timeline/skills form; 'strategy' = the second segment
   *  (timeframe / weekly hours / constraints), reachable after analysis. */
  segment: CareerSetupSegment;
  currentRole: string;
  targetRole: string;
  timelineMonths: number;
  skills: string[];
  timeframeWeeks: number;
  weeklyHours: number;
  constraints: string;
  loading: boolean;
  error: string | null;
  onChangeCurrentRole: (v: string) => void;
  onChangeTargetRole: (v: string) => void;
  onChangeTimelineMonths: (months: number) => void;
  onAddSkill: (skill: string) => void;
  onRemoveSkill: (skill: string) => void;
  onChangeTimeframeWeeks: (weeks: number) => void;
  onChangeWeeklyHours: (hours: number) => void;
  onChangeConstraints: (v: string) => void;
  onAnalyse: () => void;
  onGenerateStrategy: () => void;
  onClose: () => void;
}

/**
 * The Career questionnaire as a sheet (Ink + Signal §3.3): the form leaves the
 * screen body entirely so the screen can lead with value (Dilution trap 2 —
 * career.tsx is TextInput-free at file level; the hierarchyGuards test enforces
 * it). RN `Modal` transparent slide-from-bottom, surface `c.surface`, top radii
 * `radii.card`, maxHeight 90%, KeyboardAvoidingView per the legacy save-modal
 * pattern. Both legacy form segments live here verbatim: the setup form
 * (role inputs with rotating placeholders, timeline pills, skills tag input,
 * error display) and the strategy inputs (timeframe / weekly hours /
 * constraints). The legacy caps eyebrows did not move with the form — Guard D
 * bans new caps surfaces, and the sheet's headline does the talking.
 */
export function CareerSetupSheet({
  visible,
  segment,
  currentRole,
  targetRole,
  timelineMonths,
  skills,
  timeframeWeeks,
  weeklyHours,
  constraints,
  loading,
  error,
  onChangeCurrentRole,
  onChangeTargetRole,
  onChangeTimelineMonths,
  onAddSkill,
  onRemoveSkill,
  onChangeTimeframeWeeks,
  onChangeWeeklyHours,
  onChangeConstraints,
  onAnalyse,
  onGenerateStrategy,
  onClose,
}: CareerSetupSheetProps) {
  const c = useColors();
  // Transient input state — the committed skill list lives on the screen.
  const [skillInput, setSkillInput] = useState('');

  const addSkill = () => {
    const t = skillInput.trim();
    if (t) onAddSkill(t);
    setSkillInput('');
  };

  const renderError = () =>
    error ? (
      <Caption style={{ color: c.error, marginTop: spacing.sm }}>
        {/^\s*\[?\s*\{/.test(error)
          ? "We couldn't read the AI's response. Try again or tweak the inputs."
          : error}
      </Caption>
    ) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: c.overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close career setup"
        />
        <View style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.sheetContent}
          >
            <View style={[styles.handle, { backgroundColor: c.border }]} />

            {segment === 'setup' ? (
              <>
                <Heading style={[styles.heading, { color: c.textPrimary }]}>
                  Where are you going?
                </Heading>

                <View style={styles.formGap}>
                  <Input
                    label="Current role"
                    accessibilityLabel="Current role"
                    rotatingPlaceholders={CURRENT_ROLE_PLACEHOLDERS}
                    value={currentRole}
                    onChangeText={onChangeCurrentRole}
                  />

                  <Input
                    label="Target role"
                    accessibilityLabel="Target role"
                    rotatingPlaceholders={TARGET_ROLE_PLACEHOLDERS}
                    value={targetRole}
                    onChangeText={onChangeTargetRole}
                  />

                  <View>
                    <Label style={[styles.fieldLabel, { color: c.textSecondary }]}>Timeline</Label>
                    <View style={styles.timelineRow}>
                      {TIMELINE_OPTIONS.map((opt) => (
                        <Pressable
                          key={opt.months}
                          style={[
                            styles.timelinePill,
                            { borderColor: c.border },
                            timelineMonths === opt.months && {
                              backgroundColor: c.career,
                              borderColor: c.career,
                            },
                          ]}
                          onPress={() => onChangeTimelineMonths(opt.months)}
                        >
                          <Caption
                            style={[
                              styles.timelineLabel,
                              {
                                color:
                                  timelineMonths === opt.months ? c.inkOnColor : c.textSecondary,
                              },
                            ]}
                          >
                            {opt.label}
                          </Caption>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View>
                    <Label style={[styles.fieldLabel, { color: c.textSecondary }]}>
                      Your current skills
                    </Label>
                    <View style={styles.skillInputRow}>
                      <View style={styles.skillInputWrap}>
                        <TextInput
                          style={[
                            styles.skillTextInput,
                            styles.skillInputFlush,
                            {
                              backgroundColor: c.surface,
                              borderColor: c.border,
                              color: c.textPrimary,
                            },
                          ]}
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
                          style={styles.skillRotating}
                        />
                      </View>
                      <Pressable
                        style={[styles.addBtn, { backgroundColor: c.career }]}
                        onPress={addSkill}
                        accessibilityRole="button"
                        accessibilityLabel="Add skill"
                      >
                        <Ionicons name="add" size={20} color={c.inkOnColor} />
                      </Pressable>
                    </View>
                    {skills.length > 0 && (
                      <View style={styles.skillsRow}>
                        {skills.map((sk) => (
                          <Pressable key={sk} onPress={() => onRemoveSkill(sk)}>
                            <Badge label={`${sk} ×`} variant="career" />
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>

                  <Button3D
                    title="Analyse my career path"
                    loadingTitle="Analysing…"
                    loading={loading}
                    onPress={onAnalyse}
                    disabled={!currentRole.trim() || !targetRole.trim() || loading}
                    fullWidth
                  />
                  {renderError()}
                </View>
              </>
            ) : (
              <>
                <Heading style={[styles.heading, { color: c.textPrimary }]}>
                  Turn it into a plan
                </Heading>
                <Caption style={{ color: c.textSecondary }}>
                  Generate a no-fluff execution plan: Reality Check, 12-week phases, daily + weekly
                  artifacts.
                </Caption>

                <View style={styles.formGap}>
                  <View>
                    <Label style={[styles.fieldLabel, { color: c.textSecondary }]}>Timeframe</Label>
                    <View style={styles.timelineRow}>
                      {STRATEGY_TIMEFRAMES.map((opt) => (
                        <Pressable
                          key={opt.weeks}
                          style={[
                            styles.timelinePill,
                            { borderColor: c.border },
                            timeframeWeeks === opt.weeks && {
                              backgroundColor: c.career,
                              borderColor: c.career,
                            },
                          ]}
                          onPress={() => onChangeTimeframeWeeks(opt.weeks)}
                        >
                          <Caption
                            style={[
                              styles.timelineLabel,
                              {
                                color:
                                  timeframeWeeks === opt.weeks ? c.inkOnColor : c.textSecondary,
                              },
                            ]}
                          >
                            {opt.label}
                          </Caption>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View>
                    <Label style={[styles.fieldLabel, { color: c.textSecondary }]}>
                      Weekly hours
                    </Label>
                    <View style={styles.timelineRow}>
                      {HOURS_OPTIONS.map((h) => (
                        <Pressable
                          key={h}
                          style={[
                            styles.timelinePill,
                            { borderColor: c.border },
                            weeklyHours === h && {
                              backgroundColor: c.career,
                              borderColor: c.career,
                            },
                          ]}
                          onPress={() => onChangeWeeklyHours(h)}
                        >
                          <Caption
                            style={[
                              styles.timelineLabel,
                              { color: weeklyHours === h ? c.inkOnColor : c.textSecondary },
                            ]}
                          >
                            {h}h
                          </Caption>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View>
                    <Label style={[styles.fieldLabel, { color: c.textSecondary }]}>
                      Constraints (optional)
                    </Label>
                    <TextInput
                      style={[
                        styles.skillTextInput,
                        { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary },
                      ]}
                      placeholder="e.g. full-time job, toddler at home"
                      placeholderTextColor={c.textMuted}
                      value={constraints}
                      onChangeText={onChangeConstraints}
                    />
                  </View>

                  <Button3D
                    title="Generate strategy"
                    loadingTitle="Designing strategy…"
                    loading={loading}
                    onPress={onGenerateStrategy}
                    fullWidth
                  />
                  {renderError()}
                </View>
              </>
            )}

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeAction}
            >
              <Body style={{ color: c.textSecondary }}>Close</Body>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    borderWidth: 1,
    maxHeight: '90%',
  },
  sheetContent: {
    padding: spacing.xl,
    gap: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  heading: { fontSize: fontSizes.xl },
  formGap: { gap: spacing.md, marginTop: spacing.sm },
  fieldLabel: { marginBottom: spacing.xs },
  timelineRow: { flexDirection: 'row', gap: spacing.sm },
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
  closeAction: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
});
