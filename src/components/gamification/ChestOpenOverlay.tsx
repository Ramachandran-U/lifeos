import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { MOTION_BUDGET, EASING, useMotionScale } from '@/theme/motion';
import { haptic } from '@/utils/haptics';
import { playSfx } from '@/sound/soundEngine';
import { CelebrationBurst } from './CelebrationBurst';
import { cosmeticById } from '@/constants/cosmetics';
import type { ChestContents } from '@/gamification/lootTable';

interface Props {
  /** Non-null mounts the overlay; the roll happens at the burst beat. */
  visible: boolean;
  /** Perform the roll (useChestStore.open). Called exactly once, at the peak. */
  onOpen: () => ChestContents | null;
  onClose: () => void;
}

// Chest reveal (variable_rewards_v1) — anticipation pause → burst + heavy
// haptic → reveal. The pause is the whole trick: variable rewards land on the
// moment BEFORE the outcome is known. Reduce-motion (or motion 'off') skips
// the theatre entirely and goes straight to the result — anticipation is a
// treat, never a toll. No timers, no "opening..." spinner, no way to fail.
export function ChestOpenOverlay({ visible, onOpen, onClose }: Props) {
  const c = useColors();
  const motionScale = useMotionScale();
  const [contents, setContents] = useState<ChestContents | null>(null);
  const wiggle = useSharedValue(0);

  const reduceMotion = motionScale === 0;
  // Anticipation rides the rewardHold token (the chip dwell) — long enough to
  // register, short enough to never feel like a loading screen.
  const anticipationMs = reduceMotion ? 0 : MOTION_BUDGET.rewardHold;

  useEffect(() => {
    if (!visible) {
      setContents(null);
      return;
    }
    if (!reduceMotion) {
      haptic.medium();
      wiggle.value = withRepeat(
        withSequence(
          withTiming(-1, { duration: MOTION_BUDGET.pressFeedback, easing: EASING.inOut }),
          withTiming(1, { duration: MOTION_BUDGET.pressFeedback, easing: EASING.inOut }),
        ),
        -1,
        true,
      );
    }
    const t = setTimeout(() => {
      wiggle.value = withTiming(0, { duration: MOTION_BUDGET.pressFeedback });
      const rolled = onOpen();
      if (!rolled) {
        onClose(); // already opened elsewhere — nothing to reveal
        return;
      }
      haptic.heavy();
      playSfx('sparkle'); // M5 — double opt-in gated inside the engine
      setContents(rolled);
    }, anticipationMs);
    return () => clearTimeout(t);
    // Fire once per show — onOpen/onClose identities may change per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const wiggleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${wiggle.value * 6}deg` }],
  }));

  if (!visible) return null;

  const revealed = contents !== null;
  const drop = contents === null ? null : describeDrop(contents);

  return (
    <Animated.View
      entering={FadeIn.duration(MOTION_BUDGET.microFeedback)}
      exiting={FadeOut.duration(MOTION_BUDGET.microFeedback)}
      style={[styles.scrim, { backgroundColor: c.overlay }]}
    >
      {revealed && !reduceMotion && (
        <CelebrationBurst palette={[c.xp, c.badge, c.streak]} count={16} size={8} originTop={220} />
      )}

      {!revealed ? (
        <Animated.Text style={[styles.chestGlyph, wiggleStyle]}>🎁</Animated.Text>
      ) : (
        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.duration(MOTION_BUDGET.reveal)}
          style={[styles.revealCard, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          <Text style={styles.revealGlyph}>{drop!.emoji}</Text>
          <Text style={[styles.revealTitle, { color: c.textPrimary }]}>{drop!.title}</Text>
          <Text style={[styles.revealSub, { color: c.textMuted }]}>{drop!.sub}</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Dismiss chest reward"
            style={[styles.cta, { backgroundColor: c.xp }]}
          >
            <Text style={[styles.ctaText, { color: c.inkOnColor }]}>Nice</Text>
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
  );
}

function describeDrop(contents: ChestContents): { emoji: string; title: string; sub: string } {
  switch (contents.type) {
    case 'xp':
      return {
        emoji: '✨',
        title: `+${contents.amount} XP`,
        sub: 'Straight onto your total.',
      };
    case 'freeze':
      return {
        emoji: '🛡️',
        title: 'A streak shield',
        sub: 'Banked. It will auto-spend if a streak would ever break.',
      };
    case 'cosmetic': {
      const meta = cosmeticById(contents.cosmeticId);
      return {
        emoji: meta?.emoji ?? '🎀',
        title: meta?.label ?? 'A new cosmetic',
        sub: 'Added to your collection — your companion can wear it.',
      };
    }
  }
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 70, // above every passive layer; this one is interactive
    padding: spacing.xl,
  },
  chestGlyph: { fontSize: 72 },
  revealCard: {
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 1,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    maxWidth: 420,
    width: '100%',
  },
  revealGlyph: { fontSize: 56 },
  revealTitle: { fontFamily: fonts.heading, fontSize: fontSizes.xl },
  revealSub: { fontFamily: fonts.body, fontSize: fontSizes.sm, textAlign: 'center', lineHeight: 20 },
  cta: {
    marginTop: spacing.md,
    minHeight: 48,
    minWidth: 160,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  ctaText: { fontFamily: fonts.heading, fontSize: fontSizes.md },
});
