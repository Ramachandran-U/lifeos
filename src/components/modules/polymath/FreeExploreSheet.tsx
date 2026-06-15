import { useState } from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Button3D } from '@/components/ui/Button3D';
import { Input } from '@/components/ui/Input';
import { Body, Heading } from '@/components/ui/Typography';

/**
 * Free-text "explore any idea" — a Dive on an arbitrary phrase, not a tracked
 * interest. Opens a single-idea rabbit hole on whatever the user types. Mirrors
 * AddInterestSheet's modal pattern; the polymath tone is the AI/curiosity voice.
 */
interface Props {
  visible: boolean;
  onClose: () => void;
  onExplore: (phrase: string) => void;
}

export function FreeExploreSheet({ visible, onClose, onExplore }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const [text, setText] = useState('');

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onExplore(t);
    setText('');
    onClose();
  };

  const handleClose = () => {
    setText('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Heading style={styles.title}>Explore any idea</Heading>
          <Body style={styles.subtitle}>
            Type anything you&apos;re curious about — we&apos;ll open a rabbit hole on it.
          </Body>
          <Input
            label="Idea"
            placeholder="e.g. Why do cities grow?"
            value={text}
            onChangeText={setText}
          />
          <Button3D title="Start exploring" tone="polymath" onPress={submit} disabled={!text.trim()} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
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
});
