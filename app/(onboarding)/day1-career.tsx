import { useState } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { NarrationToggle } from '@/components/shared/NarrationToggle';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Body, Heading, Label } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { useAI } from '@/hooks/useAI';
import { analyseSkillGap } from '@/ai/functions';
import { useUserStore } from '@/store/useUserStore';
import { updateUser } from '@/db/queries/users';
import type { SkillGapAnalysis } from '@/ai/types';

const TIMELINE_OPTIONS = [
  { label: '1 year', months: 12 },
  { label: '2 years', months: 24 },
  { label: '3 years', months: 36 },
  { label: '5 years', months: 60 },
];

export default function Day1CareerScreen() {
  const router = useRouter();
  const { call, loading, error } = useAI();
  const { userId, setOnboardingStage } = useUserStore();
  const c = useColors();
  const styles = makeStyles(c);

  const [currentRole, setCurrentRole] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [selectedTimeline, setSelectedTimeline] = useState(24);
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<SkillGapAnalysis | null>(null);

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setSkillInput('');
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleAnalyse = async () => {
    if (!currentRole.trim() || !targetRole.trim()) return;

    const result = await call(() =>
      analyseSkillGap({
        currentRole,
        targetRole,
        timelineMonths: selectedTimeline,
        currentSkills: skills,
      })
    );

    if (result) {
      setAnalysis(result);
    }
  };

  const handleContinue = () => {
    if (userId) {
      updateUser(userId, { onboardingStage: 2 });
      setOnboardingStage(2);
    }
    router.push('/(onboarding)/day1-routine');
  };

  return (
    <SafeAreaView style={styles.container}>
      <AuroraBackground />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <NarrationToggle scriptId="day1-career" />
          <Animated.View entering={FadeInDown.duration(600)}>
            <Heading style={styles.title}>Career growth</Heading>
            <Body style={styles.subtitle}>Where are you, and where do you want to be?</Body>
          </Animated.View>

          <View style={styles.form}>
            <Input
              label="Current role"
              placeholder="e.g. Software Engineer"
              value={currentRole}
              onChangeText={setCurrentRole}
            />

            <Input
              label="Target role"
              placeholder="e.g. Senior Product Manager"
              value={targetRole}
              onChangeText={setTargetRole}
            />

            <Label style={styles.label}>Timeline</Label>
            <View style={styles.timelineRow}>
              {TIMELINE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.months}
                  style={[
                    styles.timelinePill,
                    selectedTimeline === opt.months && styles.timelinePillActive,
                  ]}
                  onPress={() => setSelectedTimeline(opt.months)}
                >
                  <Body
                    style={[
                      styles.timelineText,
                      selectedTimeline === opt.months && styles.timelineTextActive,
                    ]}
                  >
                    {opt.label}
                  </Body>
                </Pressable>
              ))}
            </View>

            <Input
              label="Your skills (press enter to add)"
              placeholder="e.g. JavaScript"
              value={skillInput}
              onChangeText={setSkillInput}
              onSubmitEditing={addSkill}
              returnKeyType="done"
            />

            {skills.length > 0 && (
              <View style={styles.skillsRow}>
                {skills.map((skill) => (
                  <Pressable key={skill} onPress={() => removeSkill(skill)}>
                    <Badge label={`${skill} ×`} variant="career" />
                  </Pressable>
                ))}
              </View>
            )}

            {!analysis && !loading && (
              <Button
                title="Analyse my skill gaps"
                onPress={handleAnalyse}
                disabled={!currentRole.trim() || !targetRole.trim()}
              />
            )}

            {loading && (
              <View style={styles.loadingContainer}>
                <LoadingDots />
                <Body style={styles.loadingText}>Analysing your career path...</Body>
              </View>
            )}

            {error && <Body style={styles.errorText}>{error}</Body>}
          </View>

          {analysis && (
            <Animated.View entering={FadeInDown.duration(600)} style={styles.preview}>
              <Label style={styles.previewLabel}>TOP SKILL GAPS</Label>
              {analysis.gaps.slice(0, 3).map((gap) => (
                <Card key={gap.skill} moduleColor={c.career} style={styles.gapCard}>
                  <Body style={styles.gapSkill}>{gap.skill}</Body>
                  <View style={styles.gapLevels}>
                    <Badge label={gap.currentLevel} variant="default" />
                    <Body style={styles.arrow}>→</Body>
                    <Badge label={gap.requiredLevel} variant="career" />
                  </View>
                </Card>
              ))}

              <Button
                title="Start building these skills"
                onPress={handleContinue}
                style={styles.continueButton}
              />
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
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
  },
  title: {
    marginTop: spacing.xl,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  form: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  label: {
    marginBottom: -spacing.sm,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timelinePill: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  timelinePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timelineText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
  },
  timelineTextActive: {
    color: colors.textPrimary,
    fontFamily: fonts.bodyMedium,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
  },
  preview: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  previewLabel: {
    color: colors.career,
    letterSpacing: 2,
  },
  gapCard: {
    gap: spacing.sm,
  },
  gapSkill: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
  },
  gapLevels: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  arrow: {
    color: colors.textMuted,
  },
  continueButton: {
    marginTop: spacing.lg,
  },
});
