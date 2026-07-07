import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Body, Caption, Heading } from '@/components/ui/Typography';
import { Input } from '@/components/ui/Input';

interface Props {
  visible: boolean;
  /** Which endpoint of the frontier edge is being changed. */
  slot: 'a' | 'b';
  /** Name currently in this slot (null = slot B is empty / solo mode). */
  current: string | null;
  /** Name occupying the other slot — disabled here to avoid a self-pair. */
  otherSelection: string | null;
  /** The user's interest names to choose from. */
  interests: string[];
  onClose: () => void;
  /**
   * `name` is an interest name or a trimmed custom entry (used ad-hoc for
   * this frontier only — never saved to the interest list). `null` is emitted
   * only for slot 'b': solo mode, explore the first interest on its own.
   */
  onPick: (name: string | null) => void;
}

const MAX_CUSTOM_LEN = 60;

/**
 * Endpoint picker for the frontier edge: one of the user's interests, a
 * typed custom field, or (slot B only) nothing at all — a solo frontier.
 */
export function FrontierPickerSheet({
  visible,
  slot,
  current,
  otherSelection,
  interests,
  onClose,
  onPick,
}: Props) {
  const c = useColors();
  const [custom, setCustom] = useState('');

  const pick = (name: string | null) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCustom('');
    onPick(name);
  };

  const submitCustom = () => {
    const trimmed = custom.trim();
    if (trimmed.length === 0) return;
    if (otherSelection && trimmed.toLowerCase() === otherSelection.toLowerCase()) return;
    pick(trimmed);
  };

  const close = () => {
    setCustom('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={[styles.overlay, { backgroundColor: c.overlay }]} onPress={close} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
        style={styles.avoider}
      >
        <View style={[styles.sheet, { backgroundColor: c.surface, borderTopColor: c.border }]}>
          <Heading style={{ color: c.textPrimary, marginBottom: spacing.xs }}>
            {slot === 'a' ? 'First interest' : 'Second interest'}
          </Heading>
          <Caption style={{ color: c.textMuted, marginBottom: spacing.sm }}>
            The frontier is redrawn around whatever you pick. Custom entries are used once, not
            added to your interests.
          </Caption>

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {slot === 'b' ? (
              <Pressable
                onPress={() => pick(null)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: pressed ? c.card : 'transparent',
                    borderColor: current === null ? c.polymath : c.border,
                  },
                ]}
              >
                <Ionicons
                  name={current === null ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={current === null ? c.polymath : c.textMuted}
                />
                <View style={styles.rowText}>
                  <Body style={{ color: c.textPrimary }}>None — just one interest</Body>
                  <Caption style={{ color: c.textMuted }}>
                    Find an unexplored edge within the first interest alone
                  </Caption>
                </View>
              </Pressable>
            ) : null}

            {interests.map((name) => {
              const active = current !== null && name.toLowerCase() === current.toLowerCase();
              const taken =
                otherSelection !== null && name.toLowerCase() === otherSelection.toLowerCase();
              return (
                <Pressable
                  key={name}
                  onPress={() => !taken && pick(name)}
                  disabled={taken}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: pressed ? c.card : 'transparent',
                      borderColor: active ? c.polymath : c.border,
                      opacity: taken ? 0.4 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={active ? c.polymath : c.textMuted}
                  />
                  <View style={styles.rowText}>
                    <Body style={{ color: c.textPrimary }}>{name}</Body>
                    {taken ? (
                      <Caption style={{ color: c.textMuted }}>Already on the other side</Caption>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.customRow}>
            <View style={styles.customInput}>
              <Input
                value={custom}
                onChangeText={setCustom}
                placeholder="Or type anything…"
                maxLength={MAX_CUSTOM_LEN}
                autoCapitalize="sentences"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={submitCustom}
              />
            </View>
            <Pressable
              onPress={submitCustom}
              disabled={custom.trim().length === 0}
              accessibilityRole="button"
              accessibilityLabel="Use custom interest"
              style={[
                styles.customBtn,
                { backgroundColor: custom.trim().length === 0 ? c.card : c.polymath },
              ]}
            >
              <Ionicons
                name="arrow-forward"
                size={18}
                color={custom.trim().length === 0 ? c.textMuted : c.inkOnColor}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject },
  avoider: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  list: { maxHeight: 320 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  rowText: { flex: 1 },
  customRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  customInput: { flex: 1 },
  customBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    // Aligns with the Input's text box (which sits below the Input's own top gap).
    marginTop: spacing.xs,
  },
});
