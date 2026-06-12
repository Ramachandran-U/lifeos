import { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts } from '@/theme/typography';
import { Button3D } from '@/components/ui/Button3D';
import { Input } from '@/components/ui/Input';
import { Body, Heading, Caption, Label } from '@/components/ui/Typography';
import { SEX_OPTIONS, ACTIVITY_OPTIONS, GOAL_OPTIONS, type ActivityLevel } from '@/utils/health';

interface Props {
  visible: boolean;
  initialWeightKg: number | null;
  initialHeightCm: number | null;
  initialAge?: number | null;
  initialSex?: string | null;
  initialActivityLevel?: string | null;
  initialGoalType?: string | null;
  onClose: () => void;
  onSave: (data: {
    weightKg?: number;
    heightCm?: number;
    age?: number;
    sex?: string;
    activityLevel?: string;
    goalType?: string;
  }) => void;
}

// Age bounds for the calorie formula: below 13 the Mifflin–St Jeor adult
// equation doesn't apply, and >100 is almost always a typo that would skew BMR.
const MIN_AGE = 13;
const MAX_AGE = 100;

export function EditVitalsSheet({
  visible,
  initialWeightKg,
  initialHeightCm,
  initialAge,
  initialSex,
  initialActivityLevel,
  initialGoalType,
  onClose,
  onSave,
}: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<string | null>(null);
  const [activity, setActivity] = useState<string | null>(null);
  const [goalType, setGoalType] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setWeight(initialWeightKg != null ? String(initialWeightKg) : '');
      setHeight(initialHeightCm != null ? String(initialHeightCm) : '');
      setAge(initialAge != null ? String(initialAge) : '');
      setSex(initialSex ?? null);
      setActivity(initialActivityLevel ?? null);
      setGoalType(initialGoalType ?? null);
    }
  }, [visible, initialWeightKg, initialHeightCm, initialAge, initialSex, initialActivityLevel, initialGoalType]);

  // Inline validation so invalid input is explained, not silently dropped.
  const ageNum = parseInt(age, 10);
  const weightNum = parseFloat(weight);
  const heightNum = parseFloat(height);
  const ageError = age.trim() && (!Number.isFinite(ageNum) || ageNum < MIN_AGE || ageNum > MAX_AGE)
    ? `Enter an age between ${MIN_AGE} and ${MAX_AGE}`
    : null;
  const weightError = weight.trim() && (!Number.isFinite(weightNum) || weightNum <= 0)
    ? 'Enter a weight in kg greater than 0'
    : null;
  const heightError = height.trim() && (!Number.isFinite(heightNum) || heightNum <= 0)
    ? 'Enter a height in cm greater than 0'
    : null;
  const hasError = Boolean(ageError || weightError || heightError);

  const handleSave = () => {
    if (hasError) return;
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseInt(age, 10);
    const payload: { weightKg?: number; heightCm?: number; age?: number; sex?: string; activityLevel?: string; goalType?: string } = {};
    if (Number.isFinite(w) && w > 0 && w !== initialWeightKg) payload.weightKg = w;
    if (Number.isFinite(h) && h > 0 && h !== initialHeightCm) payload.heightCm = h;
    // Age is the gating input for a personalised target — Mifflin–St Jeor needs
    // it, and without it the engine returns the generic 2000 kcal fallback.
    if (Number.isFinite(a) && a >= MIN_AGE && a <= MAX_AGE && a !== initialAge) payload.age = a;
    if (sex && sex !== initialSex) payload.sex = sex;
    if (activity && activity !== initialActivityLevel) payload.activityLevel = activity;
    if (goalType && goalType !== initialGoalType) payload.goalType = goalType;
    onSave(payload);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.handle} />
            <Heading style={styles.title}>Update vitals</Heading>
            <Body style={styles.subtitle}>
              Weight is logged daily. Age, height, sex, and activity tune your calorie target.
            </Body>

            <Input
              label="Weight (kg)"
              placeholder="70"
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
            />
            {weightError && <Caption style={{ color: c.error }}>{weightError}</Caption>}
            <Input
              label="Height (cm)"
              placeholder="175"
              value={height}
              onChangeText={setHeight}
              keyboardType="decimal-pad"
            />
            {heightError && <Caption style={{ color: c.error }}>{heightError}</Caption>}
            <Input
              label="Age"
              placeholder="30"
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
            />
            {ageError && <Caption style={{ color: c.error }}>{ageError}</Caption>}

            <Label style={styles.fieldLabel}>Sex (for calorie accuracy)</Label>
            <View style={styles.chipRow}>
              {SEX_OPTIONS.map((o) => (
                <Pressable
                  key={o.value}
                  onPress={() => setSex(o.value)}
                  style={[styles.chip, sex === o.value && { backgroundColor: c.health, borderColor: c.health }]}
                >
                  <Caption style={sex === o.value ? styles.chipTextActive : undefined}>{o.label}</Caption>
                </Pressable>
              ))}
            </View>

            <Label style={styles.fieldLabel}>Activity level</Label>
            <View style={styles.chipRow}>
              {ACTIVITY_OPTIONS.map((o: { value: ActivityLevel; label: string; hint: string }) => (
                <Pressable
                  key={o.value}
                  onPress={() => setActivity(o.value)}
                  style={[styles.chip, activity === o.value && { backgroundColor: c.health, borderColor: c.health }]}
                >
                  <Caption style={activity === o.value ? styles.chipTextActive : undefined}>{o.label}</Caption>
                </Pressable>
              ))}
            </View>

            <Label style={styles.fieldLabel}>Goal (shifts your calorie target)</Label>
            <View style={styles.chipRow}>
              {GOAL_OPTIONS.map((o) => (
                <Pressable
                  key={o.value}
                  onPress={() => setGoalType(o.value)}
                  style={[styles.chip, goalType === o.value && { backgroundColor: c.health, borderColor: c.health }]}
                >
                  <Caption style={goalType === o.value ? styles.chipTextActive : undefined}>{o.label}</Caption>
                </Pressable>
              ))}
            </View>

            <Button3D title="Save" tone="health" onPress={handleSave} disabled={hasError} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    gap: spacing.md,
    maxHeight: '90%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  title: { textAlign: 'left' },
  subtitle: { color: colors.textSecondary, marginBottom: spacing.sm },
  fieldLabel: { marginTop: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipTextActive: { color: '#fff', fontFamily: fonts.bodyMedium },
});
