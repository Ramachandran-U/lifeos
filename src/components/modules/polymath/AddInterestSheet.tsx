import { useState } from 'react';
import { View, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Body, Heading, Label } from '@/components/ui/Typography';

const CATEGORIES = [
  'arts', 'science', 'tech', 'sports', 'music', 'writing', 'language', 'philosophy', 'other',
] as const;
type Category = typeof CATEGORIES[number];

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (data: { name: string; category: Category; weeklyMinutesTarget: number }) => void;
}

export function AddInterestSheet({ visible, onClose, onAdd }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('tech');
  const [target, setTarget] = useState('60');

  const reset = () => {
    setName('');
    setCategory('tech');
    setTarget('60');
  };

  const handleSave = () => {
    const mins = parseInt(target, 10);
    if (!name.trim() || !Number.isFinite(mins) || mins <= 0) return;
    onAdd({ name: name.trim(), category, weeklyMinutesTarget: mins });
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
          <Heading style={styles.title}>Add an interest</Heading>
          <Body style={styles.subtitle}>Track something you want to explore weekly.</Body>

          <Input label="Name" placeholder="e.g. Jazz piano" value={name} onChangeText={setName} />

          <Label style={styles.sectionLabel}>Category</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {CATEGORIES.map((c) => {
              const active = c === category;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Label color={active ? colors.background : colors.textSecondary}>{c}</Label>
                </Pressable>
              );
            })}
          </ScrollView>

          <Input
            label="Weekly target (minutes)"
            placeholder="60"
            value={target}
            onChangeText={setTarget}
            keyboardType="number-pad"
          />

          <Button title="Add interest" onPress={handleSave} disabled={!name.trim()} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
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
});
