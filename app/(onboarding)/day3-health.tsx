import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { useStaggerDelay } from '@/theme/motion';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Body, Heading, Label, Caption } from '@/components/ui/Typography';
import { useUserStore } from '@/store/useUserStore';
import { updateUser } from '@/db/queries/users';
import { createHealthLog } from '@/db/queries/health';
import { logBehaviourEvent } from '@/db/queries/behaviour';
import { SEX_OPTIONS, ACTIVITY_OPTIONS, GOAL_OPTIONS } from '@/utils/health';

const SLEEP_OPTIONS = [6, 7, 8, 9];

export default function Day3HealthScreen() {
  const router = useRouter();
  const c = useColors();
  const stagger = useStaggerDelay();
  const styles = makeStyles(c);
  const { userId } = useUserStore();
  const markModuleActivated = useUserStore((s) => s.markModuleActivated);

  const [weight, setWeight] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [age, setAge] = useState('');
  const [sleepTargetHours, setSleepTargetHours] = useState(8);
  const [goalType, setGoalType] = useState<string>('build_strength');
  const [sex, setSex] = useState<string | null>(null);
  const [activityLevel, setActivityLevel] = useState<string | null>(null);

  const weightNum = parseFloat(weight) || 0;
  const heightNum = parseFloat(heightCm) || 0;
  const ageNum = parseInt(age, 10);
  const ageValid = Number.isFinite(ageNum) && ageNum >= 13 && ageNum <= 100;
  const canSave = weightNum > 0 || heightNum > 0; // either is enough to start

  const handleSave = () => {
    if (!userId) return;
    try {
      // Persist one-shot facts on the user row: height, sleep target, and the
      // chosen health goal. These feed the Health Hub + routine/health prompts.
      updateUser(userId, {
        ...(heightNum > 0 ? { heightCm: heightNum } : {}),
        ...(ageValid ? { age: ageNum } : {}),
        ...(sex ? { sex } : {}),
        ...(activityLevel ? { activityLevel } : {}),
        sleepTargetHours,
        healthGoalType: goalType,
      });
      // Weight is a daily log so the trend chart can render immediately.
      if (weightNum > 0) {
        createHealthLog({
          date: format(new Date(), 'yyyy-MM-dd'),
          weight: weightNum,
          source: 'manual',
        });
      }
      logBehaviourEvent('onboarding_day3_health', 'health', {
        goalType,
        sleepTargetHours,
        weightLogged: weightNum > 0,
        heightLogged: heightNum > 0,
      });
      markModuleActivated('health');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Unknown error');
      return;
    }
    router.replace('/(tabs)/health');
  };

  return (
    <SafeAreaView style={styles.container}>
      <AuroraBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
          </Pressable>

          <Animated.View entering={FadeInDown.duration(500)}>
            <Caption style={{ color: c.health, letterSpacing: 1.5 }}>DAY 3 · HEALTH</Caption>
            <Heading style={styles.title}>Where are you starting from?</Heading>
            <Body style={styles.subtitle}>
              A couple of numbers + one goal. All of this stays on your device.
            </Body>
          </Animated.View>

          <View style={styles.form}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Weight (kg)"
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  placeholder="72.5"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Height (cm)"
                  value={heightCm}
                  onChangeText={setHeightCm}
                  keyboardType="decimal-pad"
                  placeholder="178"
                />
              </View>
            </View>

            <Input
              label="Age"
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              placeholder="30"
            />
            <Caption style={{ color: c.textMuted }}>
              Age is needed to personalise your calorie target — otherwise it stays a generic estimate.
            </Caption>

            <Label style={styles.fieldLabel}>Sleep target</Label>
            <View style={styles.chipRow}>
              {SLEEP_OPTIONS.map((h, i) => {
                const active = h === sleepTargetHours;
                return (
                  <Animated.View key={h} entering={FadeIn.delay(200 + stagger(i, 40)).duration(300)}>
                    <Pressable
                      onPress={() => setSleepTargetHours(h)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? c.healthLight : c.surface,
                          borderColor: active ? c.health : c.border,
                        },
                      ]}
                    >
                      <Body style={{ color: active ? c.health : c.textSecondary }}>{h}h</Body>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            <Label style={styles.fieldLabel}>Goal</Label>
            <View style={styles.chipGrid}>
              {GOAL_OPTIONS.map((g, i) => {
                const active = g.value === goalType;
                return (
                  <Animated.View key={g.value} entering={FadeIn.delay(200 + stagger(i, 40)).duration(300)}>
                    <Pressable
                      onPress={() => setGoalType(g.value)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? c.healthLight : c.surface,
                          borderColor: active ? c.health : c.border,
                        },
                      ]}
                    >
                      <Body style={{ color: active ? c.health : c.textSecondary }}>{g.label}</Body>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            <Label style={styles.fieldLabel}>Sex <Caption style={{ color: c.textMuted }}>· sharpens your calorie target</Caption></Label>
            <View style={styles.chipRow}>
              {SEX_OPTIONS.map((s, i) => {
                const active = s.value === sex;
                return (
                  <Animated.View key={s.value} entering={FadeIn.delay(200 + stagger(i, 40)).duration(300)}>
                    <Pressable
                      onPress={() => setSex(s.value)}
                      style={[
                        styles.chip,
                        { backgroundColor: active ? c.healthLight : c.surface, borderColor: active ? c.health : c.border },
                      ]}
                    >
                      <Body style={{ color: active ? c.health : c.textSecondary }}>{s.label}</Body>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            <Label style={styles.fieldLabel}>Activity level</Label>
            <View style={styles.chipGrid}>
              {ACTIVITY_OPTIONS.map((a, i) => {
                const active = a.value === activityLevel;
                return (
                  <Animated.View key={a.value} entering={FadeIn.delay(200 + stagger(i, 40)).duration(300)}>
                    <Pressable
                      onPress={() => setActivityLevel(a.value)}
                      style={[
                        styles.chip,
                        { backgroundColor: active ? c.healthLight : c.surface, borderColor: active ? c.health : c.border },
                      ]}
                    >
                      <Body style={{ color: active ? c.health : c.textSecondary }}>{a.label}</Body>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            <Card style={styles.note}>
              <Caption style={{ color: c.textMuted }}>
                We never sync health data off-device. HealthKit / Health Connect sync runs locally and can be turned off in Settings.
              </Caption>
            </Card>

            <Button
              title="Save & open Health"
              onPress={handleSave}
              disabled={!canSave}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  back: { alignSelf: 'flex-start', paddingTop: spacing.sm },
  title: { fontSize: fontSizes.hero, marginTop: spacing.xs, color: c.textPrimary, fontFamily: fonts.display },
  subtitle: { color: c.textSecondary, marginTop: spacing.xs },
  form: { gap: spacing.sm, marginTop: spacing.md },
  fieldLabel: { marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
  },
  note: { marginTop: spacing.sm },
});
