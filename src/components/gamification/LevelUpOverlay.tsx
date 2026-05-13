// ─── LevelUpOverlay ──────────────────────────────────────────────────────────
// Full-screen celebratory modal. Spring-in (800ms cubic-bezier) from 0.85 → 1,
// confetti dots, big level number, perk list, claim CTA. Haptic on mount.

import { useEffect } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { LEVEL_PERKS } from '@/utils/gamification';

interface LevelUpOverlayProps {
  visible: boolean;
  level: number;
  userName?: string;
  onClaim?: () => void;
  onClose: () => void;
}

export function LevelUpOverlay({ visible, level, userName, onClaim, onClose }: LevelUpOverlayProps) {
  const c = useColors();
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = 0.85;
      opacity.value = 0;
      scale.value = withTiming(1, {
        duration: 800,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      });
      opacity.value = withTiming(1, { duration: 400 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [visible, scale, opacity]);

  const modalStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const perks = LEVEL_PERKS[level] ?? ['New features unlocked', 'Keep going!'];
  const firstName = (userName ?? 'friend').split(' ')[0];

  const handleClaim = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onClaim?.();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => { /* swallow */ }}>
          <Animated.View
            style={[
              styles.modal,
              modalStyle,
              {
                backgroundColor: c.card,
                borderColor: c.primary + '44',
              },
            ]}
          >
            {/* Close */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss level-up"
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Text style={{ color: c.textMuted, fontSize: 18 }}>✕</Text>
            </Pressable>

            {/* Level number — gradient fake via solid primary (RN lacks text gradient) */}
            <Text
              style={[
                styles.levelNum,
                { color: c.primary, fontFamily: fonts.display },
              ]}
            >
              {level}
            </Text>

            <Text style={[styles.kicker, { color: c.textMuted, fontFamily: fonts.heading }]}>
              LEVEL UP
            </Text>
            <Text style={[styles.title, { color: c.textPrimary, fontFamily: fonts.display }]}>
              Congratulations, {firstName}!
            </Text>
            <Text style={[styles.subtitle, { color: c.textSecondary, fontFamily: fonts.body }]}>
              You've reached Level {level}. Here's what you've unlocked:
            </Text>

            {/* Perks */}
            <View style={[styles.perks, { backgroundColor: c.surface }]}>
              {perks.map((perk, i) => (
                <View
                  key={i}
                  style={[
                    styles.perkRow,
                    i < perks.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: c.border,
                    },
                  ]}
                >
                  <View style={[styles.perkIcon, { backgroundColor: c.primary + '22' }]}>
                    <Text>✨</Text>
                  </View>
                  <Text style={{ color: c.textPrimary, fontFamily: fonts.bodyMedium, fontSize: 14 }}>
                    {perk}
                  </Text>
                </View>
              ))}
            </View>

            {/* CTA */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Claim level-up reward"
              onPress={handleClaim}
              style={({ pressed }) => [
                styles.cta,
                {
                  backgroundColor: c.primary,
                  opacity: pressed ? 0.85 : 1,
                  shadowColor: c.primary,
                },
              ]}
            >
              <Text style={[styles.ctaText, { fontFamily: fonts.display }]}>Claim +200 XP</Text>
            </Pressable>

            <Text style={[styles.hint, { color: c.textMuted, fontFamily: fonts.body }]}>
              Tap outside to dismiss
            </Text>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 40,
    paddingTop: 48,
    paddingBottom: 40,
    alignItems: 'center',
    overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 4,
  },
  levelNum: {
    fontSize: 120,
    fontWeight: '800',
    lineHeight: 130,
    marginBottom: 8,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 32,
    textAlign: 'center',
  },
  perks: {
    width: '100%',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 8,
    marginBottom: 32,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  perkIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: 12,
    marginTop: 12,
  },
});
