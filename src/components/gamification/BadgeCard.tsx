// ─── BadgeCard ───────────────────────────────────────────────────────────────
// Earned badges glow purple; locked badges render a lock emoji at 45% opacity.
// Supports animated unlock transition via the `unlock` prop.

import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { BADGE_META, BadgeId } from '@/utils/gamification';
import { EASING, useMotionScale } from '@/theme/motion';

type UnlockState = 'idle' | 'unlocking' | 'unlocked';

interface BadgeCardProps {
  badgeId: BadgeId;
  earned: boolean;
  unlock?: UnlockState;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function BadgeCard({ badgeId, earned, unlock = 'idle' }: BadgeCardProps) {
  const c = useColors();
  const meta = BADGE_META[badgeId];
  const motionScale = useMotionScale();

  // Derive effective earned state: if unlock is 'unlocked', treat as earned
  const isEarned = unlock === 'unlocked' || (unlock === 'idle' && earned);
  const isUnlocking = unlock === 'unlocking';

  // Single progress driver for the unlock sequence (0 → 1)
  const unlockP = useSharedValue(unlock === 'unlocked' ? 1 : 0);

  useEffect(() => {
    if (unlock === 'unlocking') {
      unlockP.value = 0;
      const duration = motionScale === 0 ? 0 : 1700 * (1 / motionScale);
      unlockP.value = withTiming(1, { duration, easing: EASING.out });
    } else if (unlock === 'unlocked') {
      unlockP.value = 1;
    } else {
      unlockP.value = 0;
    }
  }, [unlock, motionScale]);

  // Lock dissolves: opacity 1 → 0 over progress 0 → 0.6
  const lockStyle = useAnimatedStyle(() => {
    if (!isUnlocking) return { opacity: isEarned ? 0 : 1 };
    const lockOpacity = interpolate(unlockP.value, [0, 0.6], [1, 0], Extrapolate.CLAMP);
    return { opacity: lockOpacity };
  });

  // Glyph springs in: opacity 0 → 1, scale 0.7 → 1 over progress 0.45 → 0.8
  const glyphStyle = useAnimatedStyle(() => {
    if (!isUnlocking) return { opacity: isEarned ? 1 : 0, transform: [{ scale: 1 }] };
    const glyphOpacity = interpolate(unlockP.value, [0.45, 0.8], [0, 1], Extrapolate.CLAMP);
    const glyphScale = interpolate(unlockP.value, [0.45, 0.8], [0.7, 1], Extrapolate.CLAMP);
    return { opacity: glyphOpacity, transform: [{ scale: glyphScale }] };
  });

  // Halo blooms: opacity 0 → 0.9 → 0, scale 0.7 → 1.3 over progress 0.3 → 0.9
  const haloStyle = useAnimatedStyle(() => {
    if (!isUnlocking) return { opacity: 0, transform: [{ scale: 0.7 }] };
    const haloOpacity = interpolate(
      unlockP.value,
      [0.3, 0.55, 0.9],
      [0, 0.9, 0],
      Extrapolate.CLAMP,
    );
    const haloScale = interpolate(unlockP.value, [0.3, 0.9], [0.7, 1.3], Extrapolate.CLAMP);
    return { opacity: haloOpacity, transform: [{ scale: haloScale }] };
  });

  // Label saturates: opacity 0 → 1 over progress 0.55 → 0.9
  const labelStyle = useAnimatedStyle(() => {
    if (!isUnlocking) return { opacity: isEarned ? 1 : 0.45 };
    const labelOpacity = interpolate(unlockP.value, [0.55, 0.9], [0, 1], Extrapolate.CLAMP);
    return { opacity: labelOpacity };
  });

  // Card-level opacity: locked = 0.45, unlocking = animates, unlocked/earned = 1
  const cardOpacity = isUnlocking ? 1 : isEarned ? 1 : 0.45;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meta.label} badge, ${isEarned ? 'earned' : isUnlocking ? 'unlocking' : 'locked'}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: c.card,
          borderColor: isEarned || isUnlocking ? c.badge + '44' : c.border,
          opacity: isEarned ? (pressed ? 0.9 : 1) : cardOpacity,
        },
      ]}
    >
      <View style={styles.orbWrapper}>
        {/* Halo — behind the orb */}
        <Animated.View
          style={[
            styles.halo,
            { backgroundColor: c.badge + '44' },
            haloStyle,
          ]}
        />
        <View
          style={[
            styles.orb,
            {
              backgroundColor: isEarned ? c.badge + '22' : c.border + '44',
              borderColor: isEarned || isUnlocking ? c.badge + '66' : c.border,
            },
          ]}
        >
          {/* Lock emoji — dissolves during unlock */}
          <Animated.Text style={[styles.orbEmoji, { position: 'absolute' }, lockStyle]}>
            🔒
          </Animated.Text>
          {/* Badge glyph — springs in during unlock */}
          <Animated.Text style={[styles.orbEmoji, { position: 'absolute' }, glyphStyle]}>
            {meta.emoji}
          </Animated.Text>
        </View>
      </View>
      <Animated.View style={[styles.meta, labelStyle]}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.bodyMedium, fontSize: 13, fontWeight: '600', color: c.textPrimary }}
        >
          {meta.label}
        </Text>
        <Text
          numberOfLines={2}
          style={{ fontFamily: fonts.body, fontSize: 11, color: c.textMuted, textAlign: 'center', lineHeight: 15 }}
        >
          {meta.desc}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  orbWrapper: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  orb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbEmoji: {
    fontSize: 28,
    lineHeight: 32,
  },
  meta: {
    alignItems: 'center',
    gap: 4,
  },
});
