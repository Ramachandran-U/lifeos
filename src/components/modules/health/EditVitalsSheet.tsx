import { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Body, Heading } from '@/components/ui/Typography';

interface Props {
  visible: boolean;
  initialWeightKg: number | null;
  initialHeightCm: number | null;
  onClose: () => void;
  onSave: (data: { weightKg?: number; heightCm?: number }) => void;
}

export function EditVitalsSheet({ visible, initialWeightKg, initialHeightCm, onClose, onSave }: Props) {
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');

  useEffect(() => {
    if (visible) {
      setWeight(initialWeightKg != null ? String(initialWeightKg) : '');
      setHeight(initialHeightCm != null ? String(initialHeightCm) : '');
    }
  }, [visible, initialWeightKg, initialHeightCm]);

  const handleSave = () => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const payload: { weightKg?: number; heightCm?: number } = {};
    if (Number.isFinite(w) && w > 0 && w !== initialWeightKg) payload.weightKg = w;
    if (Number.isFinite(h) && h > 0 && h !== initialHeightCm) payload.heightCm = h;
    onSave(payload);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Heading style={styles.title}>Update vitals</Heading>
          <Body style={styles.subtitle}>
            Weight is logged daily. Height updates your profile.
          </Body>

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

          <Button title="Save" onPress={handleSave} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
});
