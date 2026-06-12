import { useState } from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { format } from 'date-fns';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Button3D } from '@/components/ui/Button3D';
import { Input } from '@/components/ui/Input';
import { Body, Heading, Label } from '@/components/ui/Typography';

const QUICK_MINUTES = [15, 30, 45, 60, 90, 120];

interface Props {
  visible: boolean;
  interestName: string;
  onClose: () => void;
  onLog: (data: { minutesSpent: number; notes?: string; date: string }) => void;
}

export function LogExplorationSheet({ visible, interestName, onClose, onLog }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const [minutes, setMinutes] = useState('30');
  const [notes, setNotes] = useState('');

  const reset = () => {
    setMinutes('30');
    setNotes('');
  };

  const handleSave = () => {
    const mins = parseInt(minutes, 10);
    if (!Number.isFinite(mins) || mins <= 0) return;
    onLog({
      minutesSpent: mins,
      notes: notes.trim() || undefined,
      date: format(new Date(), 'yyyy-MM-dd'),
    });
    reset();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Heading style={styles.title}>Log exploration</Heading>
          <Body style={styles.subtitle}>{interestName}</Body>

          <Label style={styles.sectionLabel}>Minutes</Label>
          <View style={styles.chips}>
            {QUICK_MINUTES.map((m) => {
              const active = String(m) === minutes;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMinutes(String(m))}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Label color={active ? c.background : c.textSecondary}>{m}</Label>
                </Pressable>
              );
            })}
          </View>

          <Input
            label="Or enter custom"
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="number-pad"
          />

          <Input
            label="Notes (optional)"
            placeholder="What did you explore?"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
            style={styles.notes}
          />

          <Button3D title="Log session" tone="polymath" onPress={handleSave} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    maxHeight: '85%',
    gap: spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
  },
  title: { textAlign: 'left' },
  subtitle: { color: colors.textSecondary },
  sectionLabel: { color: colors.textSecondary, letterSpacing: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.polymath,
    borderColor: colors.polymath,
  },
  notes: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
});
