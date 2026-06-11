import { useEffect } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { AMBIENT, EASING, useMotionScale } from '@/theme/motion';
import { cosmeticById } from '@/constants/cosmetics';
import type { CompanionMood } from '@/companion/types';

interface Props {
  mood: CompanionMood;
  size?: number;
  /** Equipped cosmetic ids — rendered as a small badge until Rive binds them. */
  equipped?: readonly string[];
}

// The PERMANENT companion fallback (M3): a static glyph breathing on the
// AMBIENT.breath loop. Renders whenever the Rive path can't or shouldn't —
// riveCompanion flag off, no .riv asset yet, reduce-motion, Expo Go, or a
// runtime load error. Like ReanimatedBurst for celebrations, this is the
// designed floor, not a stopgap: never delete it in favour of Rive-only.
const MOOD_GLYPH: Record<CompanionMood, string> = {
  thriving: '😊',
  content: '🙂',
  curious: '👀',
  concerned: '🫶',
  resting: '😴',
};

export function CompanionFallback({ mood, size = 44, equipped = [] }: Props) {
  const c = useColors();
  const motionScale = useMotionScale();
  const breath = useSharedValue(1);

  // Resting companions breathe slower; reduce-motion doesn't breathe at all.
  const animate = motionScale > 0;
  useEffect(() => {
    if (!animate) {
      breath.value = 1;
      return;
    }
    const period = mood === 'resting' ? AMBIENT.auroraDrift : AMBIENT.breath;
    breath.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: period / 2, easing: EASING.inOut }),
        withTiming(1, { duration: period / 2, easing: EASING.inOut }),
      ),
      -1,
      false,
    );
  }, [animate, mood, breath]);

  const breathStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));

  const ring = mood === 'concerned' ? c.warning : mood === 'thriving' ? c.success : c.primaryDim;
  const badge = equipped.map((id) => cosmeticById(id)?.emoji).filter(Boolean)[0];

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Your companion is ${mood}`}
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.card,
          borderColor: ring + '66',
        },
      ]}
    >
      <Animated.View style={breathStyle}>
        <Text style={{ fontSize: size * 0.55 }}>{MOOD_GLYPH[mood]}</Text>
      </Animated.View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  badgeText: { fontSize: 10 },
});
