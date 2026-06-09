import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { fonts, fontSizes } from '@/theme/typography';
import { Body, Heading } from '@/components/ui/Typography';
import { MOTION_BUDGET, SPRING } from '@/theme/motion';
import { useSheetLifecycle } from '@/hooks/useSheetLifecycle';
import { Companion } from './Companion';
import { useCompanionStore } from '@/store/useCompanionStore';
import { useGameStore } from '@/store/useGameStore';
import { COSMETICS } from '@/constants/cosmetics';
import { haptic } from '@/utils/haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
  userId: string;
}

/**
 * Companion home (R3): name, plain-words mood reason, cosmetic equip grid.
 * First open doubles as the naming moment — until a name is saved the sheet
 * shows the naming form instead of the equip grid.
 *
 * Copy rules: warm, zero guilt (the mood reasons come from deriveMood, which
 * the denylist test covers). Locked cosmetics show as quiet silhouettes —
 * "found in chests", never a buy button.
 */
export function CompanionSheet({ visible, onClose, userId }: Props) {
  const c = useColors();
  const sheet = useSheetLifecycle(visible, onClose);
  const mood = useCompanionStore((s) => s.mood);
  const reason = useCompanionStore((s) => s.reason);
  const identity = useCompanionStore((s) => s.identity);
  const setName = useCompanionStore((s) => s.setName);
  const equip = useCompanionStore((s) => s.equip);
  const unequip = useCompanionStore((s) => s.unequip);
  const owned = useGameStore((s) => s.cosmetics);
  const [draftName, setDraftName] = useState('');

  const handleSaveName = () => {
    if (!draftName.trim()) return;
    haptic.success();
    setName(userId, draftName);
    setDraftName('');
  };

  const handleToggleCosmetic = (id: string, isEquipped: boolean, isOwned: boolean) => {
    if (!isOwned) return;
    haptic.selection();
    if (isEquipped) unequip(userId, id);
    else equip(userId, id);
  };

  return (
    <Modal visible={sheet.mounted} transparent animationType="fade" onRequestClose={sheet.requestClose}>
      {!sheet.closing && (
        <Animated.View
          entering={FadeIn.duration(MOTION_BUDGET.scrimEnter)}
          exiting={FadeOut.duration(MOTION_BUDGET.scrimExit)}
          style={StyleSheet.absoluteFill}
        >
          <Pressable
            style={[styles.overlay, { backgroundColor: c.overlay }]}
            onPress={sheet.requestClose}
            accessibilityLabel="Close companion sheet"
          />
        </Animated.View>
      )}
      {!sheet.closing && (
        <Animated.View
          entering={SlideInDown.springify().stiffness(SPRING.soft.stiffness).damping(SPRING.soft.damping)}
          exiting={SlideOutDown.duration(MOTION_BUDGET.sheetExit)}
          style={[styles.sheet, { backgroundColor: c.surface, borderTopColor: c.border }]}
        >
          <View style={[styles.handle, { backgroundColor: c.border }]} />

          <View style={styles.hero}>
            <Companion mood={mood} size={88} equipped={identity?.equipped ?? []} />
            <Heading style={[styles.name, { color: c.textPrimary }]}>
              {identity?.name ?? 'Your companion'}
            </Heading>
            <Body style={[styles.reason, { color: c.textMuted }]}>{reason}</Body>
          </View>

          {!identity ? (
            <View style={styles.nameForm}>
              <Body style={[styles.formLabel, { color: c.textSecondary }]}>
                They just hatched. What should we call them?
              </Body>
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                placeholder="e.g. Lumen"
                placeholderTextColor={c.textMuted}
                maxLength={24}
                accessibilityLabel="Companion name"
                style={[
                  styles.input,
                  { backgroundColor: c.card, borderColor: c.border, color: c.textPrimary },
                ]}
              />
              <Pressable
                onPress={handleSaveName}
                disabled={!draftName.trim()}
                accessibilityRole="button"
                accessibilityLabel="Save companion name"
                style={[
                  styles.cta,
                  { backgroundColor: draftName.trim() ? c.primary : c.card },
                ]}
              >
                <Text style={[styles.ctaText, { color: c.textPrimary }]}>Name them</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.wardrobe}>
              <Body style={[styles.formLabel, { color: c.textSecondary }]}>
                Wardrobe — found in chests
              </Body>
              <View style={styles.grid}>
                {COSMETICS.map((item) => {
                  const isOwned = owned.includes(item.id);
                  const isEquipped = (identity.equipped ?? []).includes(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => handleToggleCosmetic(item.id, isEquipped, isOwned)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isEquipped, disabled: !isOwned }}
                      accessibilityLabel={
                        isOwned
                          ? `${item.label}${isEquipped ? ', equipped' : ''}`
                          : `${item.label}, found in chests`
                      }
                      style={[
                        styles.tile,
                        {
                          backgroundColor: c.card,
                          borderColor: isEquipped ? c.primary : c.border,
                          opacity: isOwned ? 1 : 0.45,
                        },
                      ]}
                    >
                      <Text style={styles.tileEmoji}>{isOwned ? item.emoji : '✦'}</Text>
                      <Text style={[styles.tileLabel, { color: c.textSecondary }]} numberOfLines={1}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </Animated.View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  hero: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.lg },
  name: { textAlign: 'center', marginTop: spacing.xs },
  reason: { textAlign: 'center', fontSize: fontSizes.sm },
  nameForm: { gap: spacing.sm },
  formLabel: { fontFamily: fonts.heading, fontSize: fontSizes.sm },
  input: {
    borderRadius: radii.control,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
  },
  cta: {
    minHeight: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontFamily: fonts.heading, fontSize: fontSizes.md },
  wardrobe: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 2,
    borderRadius: radii.card,
    borderWidth: 1,
    paddingVertical: spacing.sm + 2,
  },
  tileEmoji: { fontSize: fontSizes.xl },
  tileLabel: { fontSize: fontSizes.xs },
});
