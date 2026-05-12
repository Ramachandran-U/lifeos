import { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Body, Heading, Label, Caption } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { useAI } from '@/hooks/useAI';
import { generateRoutine } from '@/ai/functions';
import { useUserStore, ONBOARDING_COMPLETE } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import { track } from '@/utils/telemetry';
import { updateUser } from '@/db/queries/users';
import { createRoutineBlocks } from '@/db/queries/routine';
import type { GeneratedRoutine } from '@/ai/types';

const TIME_OPTIONS = [
  '05:00', '05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00',
];

const SLEEP_OPTIONS = [
  '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30', '00:00',
];

const WORK_START_OPTIONS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00',
];

const WORK_END_OPTIONS = [
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00',
];

function TimePicker({ options, selected, onSelect, label }: {
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  label: string;
}) {
  const c = useColors();
  const pickerStyles = makePickerStyles(c);
  return (
    <View style={pickerStyles.container}>
      <Label>{label}</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={pickerStyles.scroll}>
        {options.map((time) => (
          <Pressable
            key={time}
            style={[pickerStyles.pill, selected === time && pickerStyles.pillActive]}
            onPress={() => onSelect(time)}
          >
            <Body style={[pickerStyles.text, selected === time && pickerStyles.textActive]}>
              {time}
            </Body>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default function Day1RoutineScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const MODULE_COLORS: Record<string, string> = {
    goal: c.goal,
    health: c.health,
    finance: c.finance,
    career: c.career,
    social: c.social,
    polymath: c.polymath,
    rest: c.textMuted,
    work: c.textSecondary,
    meal: c.warning,
  };
  const router = useRouter();
  const { call, loading, error } = useAI();
  const { userId, setOnboardingStage } = useUserStore();
  const { awardBadge } = useGameStore();

  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('22:30');
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('17:00');
  const [routine, setRoutine] = useState<GeneratedRoutine | null>(null);

  const handleGenerate = async () => {
    const result = await call(() =>
      generateRoutine({
        wakeTime,
        sleepTime,
        workStartTime: workStart,
        workEndTime: workEnd,
      })
    );

    if (result) {
      setRoutine(result);
    }
  };

  const handleSave = async () => {
    if (!routine || !userId) return;

    const today = format(new Date(), 'yyyy-MM-dd');

    createRoutineBlocks(
      routine.blocks.map((block) => ({
        date: today,
        startTime: block.startTime,
        endTime: block.endTime,
        title: block.title,
        module: block.module,
        energyRequired: block.energyRequired,
      }))
    );

    updateUser(userId, {
      wakeTime,
      sleepTime,
      workStartTime: workStart,
      workEndTime: workEnd,
      onboardingStage: ONBOARDING_COMPLETE,
    });
    setOnboardingStage(ONBOARDING_COMPLETE);
    track('onboarding_finished', { stage: ONBOARDING_COMPLETE });

    awardBadge(userId, 'first_blueprint');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
      >
        <Animated.View entering={FadeInDown.duration(600)}>
          <Heading style={styles.title}>Build your daily routine</Heading>
          <Body style={styles.subtitle}>Tell us your schedule and we'll design your day</Body>
        </Animated.View>

        <View style={styles.pickers}>
          <TimePicker options={TIME_OPTIONS} selected={wakeTime} onSelect={setWakeTime} label="Wake time" />
          <TimePicker options={SLEEP_OPTIONS} selected={sleepTime} onSelect={setSleepTime} label="Sleep time" />
          <TimePicker options={WORK_START_OPTIONS} selected={workStart} onSelect={setWorkStart} label="Work starts" />
          <TimePicker options={WORK_END_OPTIONS} selected={workEnd} onSelect={setWorkEnd} label="Work ends" />
        </View>

        {!routine && !loading && (
          <Button
            title="Generate my routine"
            onPress={handleGenerate}
            style={styles.generateButton}
          />
        )}

        {loading && (
          <View style={styles.loadingContainer}>
            <LoadingDots />
            <Body style={styles.loadingText}>Designing your perfect day...</Body>
          </View>
        )}

        {error && <Body style={styles.errorText}>{error}</Body>}

        {routine && (
          <Animated.View entering={FadeInUp.duration(600)} style={styles.routinePreview}>
            <Label style={styles.previewLabel}>YOUR DAILY BLUEPRINT</Label>
            <Card style={styles.briefingCard}>
              <Body style={styles.briefing}>{routine.briefing}</Body>
            </Card>

            {routine.blocks.map((block, i) => {
              const moduleColor = MODULE_COLORS[block.module] ?? c.textMuted;
              return (
                <Card key={i} moduleColor={moduleColor} style={styles.blockCard}>
                  <View style={styles.blockRow}>
                    <View style={styles.timeCol}>
                      <Caption>{block.startTime}</Caption>
                      <Caption>{block.endTime}</Caption>
                    </View>
                    <View style={styles.blockContent}>
                      <Body style={styles.blockTitle}>{block.title}</Body>
                      <Caption style={{ color: moduleColor }}>{block.module}</Caption>
                    </View>
                  </View>
                </Card>
              );
            })}

            <Button
              title="Save my routine"
              onPress={handleSave}
              style={styles.saveButton}
            />
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makePickerStyles = (c: AppColors) => StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  scroll: {
    flexGrow: 0,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    marginRight: spacing.sm,
  },
  pillActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  text: {
    color: c.textSecondary,
    fontSize: fontSizes.sm,
  },
  textActive: {
    color: c.textPrimary,
    fontFamily: fonts.bodyMedium,
  },
});

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
  pickers: {
    marginTop: spacing.xl,
    gap: spacing.lg,
  },
  generateButton: {
    marginTop: spacing.xl,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  routinePreview: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  previewLabel: {
    color: colors.primary,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  briefingCard: {
    marginBottom: spacing.sm,
  },
  briefing: {
    color: colors.textSecondary,
    lineHeight: 22,
  },
  blockCard: {
    paddingVertical: spacing.sm,
  },
  blockRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timeCol: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockContent: {
    flex: 1,
    gap: spacing.xs,
  },
  blockTitle: {
    fontFamily: fonts.bodyMedium,
  },
  saveButton: {
    marginTop: spacing.lg,
  },
});
