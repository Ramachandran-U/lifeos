import { useState } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Body, Heading, Label, Caption } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { useAI } from '@/hooks/useAI';
import { decomposeGoal } from '@/ai/functions';
import { useUserStore } from '@/store/useUserStore';
import { updateUser } from '@/db/queries/users';
import { createGoal } from '@/db/queries/goals';
import { persistHierarchy } from '@/utils/persistHierarchy';
import type { GoalHierarchy } from '@/ai/types';

export default function Day1VisionScreen() {
  const router = useRouter();
  const { call, loading, error } = useAI();
  const { userId, name: storedName, email: userEmail, setUser, setOnboardingStage } = useUserStore();
  const c = useColors();
  const styles = makeStyles(c);

  const [vision, setVision] = useState('');
  const [age, setAge] = useState('');
  const [hierarchy, setHierarchy] = useState<GoalHierarchy | null>(null);

  const handleBuildPlan = async () => {
    if (!vision.trim() || !userId) return;

    const result = await call(() =>
      decomposeGoal({ visionStatement: vision, name: storedName, age: age ? parseInt(age, 10) : undefined })
    );

    if (result) {
      updateUser(userId, { visionStatement: vision, age: age ? parseInt(age, 10) : undefined, onboardingStage: 1 });
      setOnboardingStage(1);
      setHierarchy(result);
    }
  };

  const handleConfirm = () => {
    if (userId && hierarchy) {
      persistHierarchy(userId, hierarchy, createGoal);
    }
    router.push('/(onboarding)/day1-career');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.Text entering={FadeIn.duration(800)} style={styles.logo}>
            LifeOS
          </Animated.Text>

          <Animated.View entering={FadeInDown.delay(300).duration(600)}>
            <Heading style={styles.title}>What's your vision for your life?</Heading>
            <Body style={styles.subtitle}>
              Describe the life you want to build. Be ambitious.
            </Body>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(500).duration(600)} style={styles.form}>
            <Input
              label="Your vision"
              placeholder="e.g. I want to lead a product team at a tech company, be fit enough to run a marathon, and have time for my family and creative projects"
              value={vision}
              onChangeText={setVision}
              multiline
              numberOfLines={4}
              style={styles.visionInput}
            />

            <Input
              label="Age (optional)"
              placeholder="28"
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
            />

            {!hierarchy && !loading && (
              <Button
                title="Build my plan"
                onPress={handleBuildPlan}
                disabled={!vision.trim()}
              />
            )}

            {loading && (
              <View style={styles.loadingContainer}>
                <LoadingDots />
                <Body style={styles.loadingText}>Understanding your vision...</Body>
              </View>
            )}

            {error && (
              <Body style={styles.errorText}>{error}</Body>
            )}
          </Animated.View>

          {hierarchy && (
            <Animated.View entering={FadeInUp.duration(600)} style={styles.preview}>
              <Label style={styles.previewLabel}>YOUR LIFE PLAN</Label>

              <Card moduleColor={c.goal} style={styles.previewCard}>
                <Label color={c.goal}>PRIMARY GOAL</Label>
                <Heading style={styles.goalTitle}>{hierarchy.primaryGoal.title}</Heading>
              </Card>

              <Card style={styles.previewCard}>
                <Label color={c.primary}>THIS YEAR</Label>
                <Body>{hierarchy.yearly.title}</Body>
                <Caption style={styles.milestone}>{hierarchy.yearly.milestone}</Caption>
              </Card>

              <Label style={styles.sectionLabel}>FIRST 3 MONTHS</Label>
              {hierarchy.monthly.map((m) => (
                <Card key={m.month} style={styles.monthCard}>
                  <Label color={c.primary}>MONTH {m.month}</Label>
                  <Body>{m.title}</Body>
                  <Caption>{m.milestone}</Caption>
                </Card>
              ))}

              <Label style={styles.sectionLabel}>THIS WEEK</Label>
              {hierarchy.weekly.slice(0, 1).map((w) => (
                <Card key={w.week} style={styles.previewCard}>
                  <Label color={c.primary}>WEEK {w.week}: {w.focus}</Label>
                  {w.tasks.map((task, i) => (
                    <Body key={i} style={styles.task}>• {task}</Body>
                  ))}
                </Card>
              ))}

              <Label style={styles.sectionLabel}>EXAMPLE DAILY TASKS</Label>
              <Card style={styles.previewCard}>
                {hierarchy.dailyTaskExamples.map((task, i) => (
                  <Body key={i} style={styles.task}>• {task}</Body>
                ))}
              </Card>

              <Button
                title="This looks right"
                onPress={handleConfirm}
                style={styles.confirmButton}
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
  logo: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xxxl,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  form: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  visionInput: {
    minHeight: 100,
    textAlignVertical: 'top',
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
    color: colors.primary,
    textAlign: 'center',
    letterSpacing: 2,
  },
  previewCard: {
    gap: spacing.xs,
  },
  goalTitle: {
    fontSize: fontSizes.xl,
    marginTop: spacing.xs,
  },
  milestone: {
    marginTop: spacing.xs,
  },
  sectionLabel: {
    color: colors.textSecondary,
    marginTop: spacing.md,
    letterSpacing: 1,
  },
  monthCard: {
    gap: spacing.xs,
  },
  task: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
  },
  confirmButton: {
    marginTop: spacing.lg,
  },
});
