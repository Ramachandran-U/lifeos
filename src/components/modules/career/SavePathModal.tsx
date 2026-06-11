import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { TIMING } from '@/theme/motion';
import { Body, Caption } from '@/components/ui/Typography';

interface SavePathModalProps {
  visible: boolean;
  saveName: string;
  onChangeSaveName: (name: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * The save-career-path modal, moved verbatim from the legacy screen (Ink +
 * Signal §3.3 / Dilution trap 2): extracting it is what makes career.tsx
 * TextInput-free at FILE level, so the hierarchyGuards ban is mechanical.
 * Behavior and chrome are unchanged.
 */
export function SavePathModal({
  visible,
  saveName,
  onChangeSaveName,
  onClose,
  onConfirm,
}: SavePathModalProps) {
  const c = useColors();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.modalOverlay, { backgroundColor: c.overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {/* Legacy used a raw 250ms here; the motion ratchet bans raw literals
            in new files — snapped to TIMING.normal (300, the sheet-fade token). */}
        <Animated.View
          entering={FadeInDown.duration(TIMING.normal)}
          style={[styles.modalBox, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          <Body style={[styles.modalTitle, { color: c.textPrimary }]}>Save career path</Body>
          <Caption style={{ color: c.textMuted, marginBottom: spacing.md }}>
            Give this path a name so you can load it later.
          </Caption>

          <TextInput
            style={[
              styles.modalInput,
              { backgroundColor: c.background, borderColor: c.border, color: c.textPrimary },
            ]}
            placeholder="e.g. My PM journey"
            placeholderTextColor={c.textMuted}
            value={saveName}
            onChangeText={onChangeSaveName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={onConfirm}
          />

          <View style={styles.modalButtons}>
            <Pressable
              style={[styles.modalBtn, { borderColor: c.border, borderWidth: 1 }]}
              onPress={onClose}
            >
              <Body style={{ color: c.textSecondary }}>Cancel</Body>
            </Pressable>
            <Pressable
              style={[styles.modalBtn, { backgroundColor: c.career }]}
              onPress={onConfirm}
              disabled={!saveName.trim()}
            >
              <Body style={{ color: c.inkOnColor, fontFamily: fonts.heading }}>Save</Body>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalBox: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  modalTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
  },
  modalInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    marginBottom: spacing.sm,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
