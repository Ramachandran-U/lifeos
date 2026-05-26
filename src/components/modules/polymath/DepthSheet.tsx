import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Body, Caption, Heading } from '@/components/ui/Typography';
import type { ExplorationDepth } from '@/ai/types';

const OPTIONS: Array<{
  value: ExplorationDepth;
  label: string;
  blurb: string;
  suggestedMinutes: number;
}> = [
  { value: 'taste',     label: 'Taste',     blurb: 'A few minutes a week to see if it sticks', suggestedMinutes: 60  },
  { value: 'hobbyist',  label: 'Hobbyist',  blurb: 'A real recurring practice',                  suggestedMinutes: 180 },
  { value: 'deep_dive', label: 'Deep dive', blurb: 'You want to get genuinely good',             suggestedMinutes: 300 },
];

interface Props {
  visible: boolean;
  current: ExplorationDepth;
  onClose: () => void;
  onPick: (depth: ExplorationDepth, suggestedMinutes: number) => void;
}

export function DepthSheet({ visible, current, onClose, onPick }: Props) {
  const c = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: c.overlay }]} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <Heading style={{ color: c.textPrimary, marginBottom: spacing.sm }}>
          How deep do you want to go?
        </Heading>
        <Caption style={{ color: c.textMuted, marginBottom: spacing.md }}>
          Picking a deeper level bumps the suggested weekly minutes — you can still edit the target.
        </Caption>
        {OPTIONS.map((opt) => {
          const active = opt.value === current;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onPick(opt.value, opt.suggestedMinutes)}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: pressed ? c.card : 'transparent',
                  borderColor: active ? c.polymath : c.border,
                },
              ]}
            >
              <Ionicons
                name={active ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={active ? c.polymath : c.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Body style={{ color: c.textPrimary }}>{opt.label}</Body>
                <Caption style={{ color: c.textMuted }}>{opt.blurb}</Caption>
              </View>
              <Caption style={{ color: c.textSecondary }}>{opt.suggestedMinutes}m/wk</Caption>
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
  },
});
