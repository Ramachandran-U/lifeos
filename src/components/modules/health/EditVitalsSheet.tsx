import { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { format, parseISO } from 'date-fns';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Body, Heading, Caption } from '@/components/ui/Typography';
import { calculateBMI } from '@/utils/health';

interface Props {
  visible: boolean;
  initialWeightKg: number | null;
  initialHeightCm: number | null;
  /** ISO timestamp of the latest body log (for reassurance). */
  lastLoggedAt?: string | null;
  /** BMI from the most recent log that had both weight and height. */
  referenceBmi?: number | null;
  onClose: () => void;
  onSave: (data: { weightKg?: number; heightCm?: number }) => void;
}

export function EditVitalsSheet({
  visible,
  initialWeightKg,
  initialHeightCm,
  lastLoggedAt,
  referenceBmi,
  onClose,
  onSave,
}: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [showBmiCompare, setShowBmiCompare] = useState(false);

  useEffect(() => {
    if (visible) {
      setWeight(initialWeightKg != null ? String(initialWeightKg) : '');
      setHeight(initialHeightCm != null ? String(initialHeightCm) : '');
      setShowBmiCompare(false);
    }
  }, [visible, initialWeightKg, initialHeightCm]);

  const wNum = parseFloat(weight);
  const hNum = parseFloat(height);
  const formBmi =
    Number.isFinite(wNum) && Number.isFinite(hNum) && wNum > 0 && hNum > 0
      ? calculateBMI(wNum, hNum)
      : null;

  const handleSave = () => {
    const payload: { weightKg?: number; heightCm?: number } = {};
    if (Number.isFinite(wNum) && wNum > 0) payload.weightKg = wNum;
    if (Number.isFinite(hNum) && hNum > 0) payload.heightCm = hNum;
    if (Object.keys(payload).length === 0) return;
    onSave(payload);
    onClose();
  };

  const canCompare = referenceBmi != null && formBmi != null;
  const bmiDelta = canCompare ? Number((formBmi - referenceBmi).toFixed(1)) : null;

  let lastLoggedLabel: string | null = null;
  if (lastLoggedAt) {
    try {
      lastLoggedLabel = format(parseISO(lastLoggedAt), "MMM d, yyyy '·' h:mm a");
    } catch {
      lastLoggedLabel = null;
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Heading style={styles.title}>Update vitals</Heading>
          <Body style={styles.subtitle}>
            Saves a timestamped entry to your health log and updates your profile height.
          </Body>
          {lastLoggedLabel ? (
            <Caption style={{ color: c.textMuted }}>Last logged: {lastLoggedLabel}</Caption>
          ) : null}

          <Input
            label="Weight (kg)"
            placeholder="70"
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
          />
          <Input
            label="Height (cm)"
            placeholder="175"
            value={height}
            onChangeText={setHeight}
            keyboardType="decimal-pad"
          />

          {canCompare ? (
            <View style={{ gap: spacing.sm }}>
              <Button
                title={showBmiCompare ? 'Hide BMI comparison' : 'Show BMI change vs last log'}
                variant="secondary"
                onPress={() => setShowBmiCompare((v) => !v)}
              />
              {showBmiCompare && bmiDelta != null ? (
                <View style={[styles.compareBox, { borderColor: c.border, backgroundColor: c.surface }]}>
                  <Caption style={{ color: c.textMuted }}>BMI journey (preview)</Caption>
                  <Body style={{ color: c.textPrimary }}>
                    {`Last recorded BMI ${referenceBmi} → with these values ${formBmi}`}
                  </Body>
                  <Body style={{ color: bmiDelta <= 0 ? c.success : c.warning }}>
                    {`Change: ${bmiDelta > 0 ? '+' : ''}${bmiDelta} vs last full log`}
                  </Body>
                </View>
              ) : null}
            </View>
          ) : null}

          <Button title="Save" onPress={handleSave} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: spacing.xl,
      gap: spacing.md,
    },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center' },
    title: { textAlign: 'left' },
    subtitle: { color: colors.textSecondary },
    compareBox: {
      borderWidth: 1,
      borderRadius: 16,
      padding: spacing.md,
      gap: spacing.xs,
    },
  });
