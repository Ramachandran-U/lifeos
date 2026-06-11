/**
 * Event-triggered install bottom sheet (install_prompt_v2,
 * docs/design-deep-dive/01-today-hero.md §3.3).
 *
 * Replaces the legacy top-of-flow install banner: the ask now happens at a
 * peak moment (first block completion of a web session, +1780ms
 * so it never collides with the XP beat) plus a quiet permanent Profile row.
 * Web-only by construction — renders null whenever the A2HS variant is null
 * (native, already installed, unsupported browser, or permanently dismissed).
 *
 * Modal structure mirrors DailySummarySheet (the verified sheet pattern).
 */
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { MOTION_BUDGET, useMotionScale } from '@/theme/motion';
import { Text as AuroraText } from '@/components/ui/Text';
import { useAddToHomeScreen, recordInstallOffer } from '@/hooks/useAddToHomeScreen';

interface InstallSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function InstallSheet({ visible, onClose }: InstallSheetProps) {
  const c = useColors();
  const motionScale = useMotionScale();
  const { variant, canInstall, install } = useAddToHomeScreen();

  if (variant === null) return null;

  const body =
    variant === 'ios'
      ? "Tap Share, then 'Add to Home Screen' — LifeOS becomes a real app on your phone."
      : canInstall
        ? 'One tap. Full screen, faster launch, no browser bar.'
        : "Open the ⋮ menu, then 'Install app'.";

  const laterLabel = variant === 'ios' ? 'Got it' : 'Not now';

  const handleDecline = () => {
    recordInstallOffer('declined');
    onClose();
  };

  const handleInstall = () => {
    recordInstallOffer('accepted');
    install();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleDecline}>
      <Animated.View
        entering={FadeIn.duration(MOTION_BUDGET.scrimEnter * motionScale)}
        exiting={FadeOut.duration(MOTION_BUDGET.scrimExit * motionScale)}
        style={StyleSheet.absoluteFill}
      >
        <Pressable
          style={[styles.overlay, { backgroundColor: c.overlay }]}
          onPress={handleDecline}
        />
      </Animated.View>
      <View
        style={[styles.sheet, { backgroundColor: c.surface, borderTopColor: c.border }]}
        testID="install-sheet"
      >
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        <View style={styles.header}>
          <AuroraText variant="h2" style={styles.title}>
            Take LifeOS full-screen.
          </AuroraText>
          <Pressable
            onPress={handleDecline}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            testID="install-sheet-close"
          >
            <Ionicons name="close" size={20} color={c.textMuted} />
          </Pressable>
        </View>
        <AuroraText variant="body" secondary>
          {body}
        </AuroraText>
        <View style={styles.actions}>
          {variant === 'android' && canInstall && (
            <Pressable
              onPress={handleInstall}
              style={[styles.primaryBtn, { backgroundColor: c.primary }]}
              testID="install-sheet-install"
              accessibilityRole="button"
            >
              <AuroraText variant="bodyLg" color={c.inkOnColor}>
                Install
              </AuroraText>
            </Pressable>
          )}
          <Pressable
            onPress={handleDecline}
            style={[styles.secondaryBtn, { borderColor: c.border }]}
            testID="install-sheet-later"
            accessibilityRole="button"
          >
            <AuroraText variant="bodyLg" color={c.textSecondary}>
              {laterLabel}
            </AuroraText>
          </Pressable>
        </View>
      </View>
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
    gap: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  title: { flex: 1 },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 56,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 56,
    borderRadius: radii.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
