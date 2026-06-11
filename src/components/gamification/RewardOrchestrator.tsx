import { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/theme/colors';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import { Text as AuroraText } from '@/components/ui/Text';
import { DomainGlyph } from '@/components/ui/DomainGlyph';
import { CelebrationBurst } from '@/components/gamification/CelebrationBurst';
import { useRewardQueueStore, type RewardBeat } from '@/store/useRewardQueueStore';
import { MOTION_BUDGET, useMotionScale } from '@/theme/motion';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { isEnabled } from '@/config/flags';
import { classifyTier } from '@/celebration/classify';
import { celebrate } from '@/celebration/useCelebrationStore';

// Mounted once at the root. Drains the reward queue with the Aurora
// choreography — currently the XP chip beat. Badge toasts and level-up
// overlays continue to be rendered by AchievementToast / LevelUpOverlay
// (this orchestrator does not replace them).

// Reduce-motion path only: how long the chip dwells before fading. No motion
// token fits (it's a static hold, not an animation beat), so it stays local.
const BURST_HOLD_MS = 800; // burst dwell before fade

export function RewardOrchestrator() {
  const active = useRewardQueueStore((s) => s.active);
  const gamification = usePreferencesStore((s) => s.gamification);
  if (!active) return null;
  if (gamification === 'off') return null; // user opted out of reward beats
  return <Beat beat={active} key={active.id} />;
}

function Beat({ beat }: { beat: RewardBeat }) {
  const c = useColors();
  const motionScale = useMotionScale();
  const complete = useRewardQueueStore((s) => s.complete);

  // M2 (celebrationEngine): forward the beat to the celebration choke point.
  // classify() decides the tier; micro beats are dropped there, so the chip's
  // own 8-particle burst stays the entire celebration for routine XP. When
  // the engine WILL render a standard/epic layer, suppress the inline burst
  // below so particles never double up. streakSave is deliberately not
  // forwarded — a freeze save is relief, not triumph (see chip comment).
  const engineTier =
    beat.type === 'xp'
      ? classifyTier({ kind: 'xp', amount: beat.amount })
      : beat.type === 'streak'
        ? classifyTier({ kind: 'streak' })
        : null;
  const engineHandlesBurst =
    isEnabled('celebrationEngine') && engineTier !== null && engineTier !== 'micro';
  useEffect(() => {
    if (beat.type === 'xp') {
      celebrate({ kind: 'xp', amount: beat.amount, domain: beat.domain });
    } else if (beat.type === 'streak') {
      celebrate({ kind: 'streak', count: beat.count });
    }
    // Keyed by beat id — one forward per beat, mirroring the animation effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat.id]);

  // Start above the rest position so the chip slides down into view on entry.
  const translateY = useSharedValue(-52);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.82);

  useEffect(() => {
    if (motionScale === 0) {
      // Reduce-motion: still show the chip briefly so the reward registers.
      opacity.value = withSequence(
        withTiming(1, { duration: 0 }),
        withDelay(BURST_HOLD_MS, withTiming(0, { duration: MOTION_BUDGET.pressFeedback }, () => runOnJS(complete)())),
      );
      return;
    }
    // Slide in from above with spring overshoot, hold, then exit upward.
    const rise = MOTION_BUDGET.rewardRise / motionScale;
    const hold = MOTION_BUDGET.rewardHold / motionScale;
    const fade = MOTION_BUDGET.rewardExit / motionScale;

    // Fade in quickly, hold opaque, then fade out.
    opacity.value = withSequence(
      withTiming(1, { duration: rise * 0.45, easing: Easing.out(Easing.cubic) }),
      withDelay(rise * 0.55 + hold, withTiming(0, { duration: fade, easing: Easing.in(Easing.cubic) },
        (finished) => { if (finished) runOnJS(complete)(); })),
    );
    // Slide down from -52 to rest (0) with a spring-like overshoot, then float up on exit.
    translateY.value = withSequence(
      withTiming(0, { duration: rise, easing: Easing.out(Easing.back(1.25)) }),
      withDelay(hold, withTiming(-32, { duration: fade, easing: Easing.in(Easing.cubic) })),
    );
    // Pop in with bounce, gently shrink on exit.
    scale.value = withSequence(
      withTiming(1, { duration: rise, easing: Easing.out(Easing.back(1.55)) }),
      withDelay(hold, withTiming(0.88, { duration: fade, easing: Easing.in(Easing.cubic) })),
    );

    if (Platform.OS !== 'web') {
      // Streak beats (and a freeze save — a near-loss moment) get a satisfying
      // Heavy "thud"; XP beats stay Light.
      const style = beat.type === 'streak' || beat.type === 'streakSave'
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Light;
      Haptics.impactAsync(style).catch(() => undefined);
    }
  }, [beat.id, beat.type, motionScale, opacity, translateY, scale, complete]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  if (beat.type === 'xp') {
    const hue = beat.domain ? (c as Record<string, string>)[beat.domain] : c.xp;
    // Regular completions get a tight 8-particle burst; milestone XP gets the full 14.
    const burstCount = beat.amount >= 50 ? 14 : 8;
    const burstSize  = beat.amount >= 50 ? 8  : 5;
    return (
      <View pointerEvents="none" style={styles.wrap}>
        {!engineHandlesBurst && (
          <CelebrationBurst
            palette={[hue, c.xp, c.primaryDim]}
            count={burstCount}
            size={burstSize}
            originTop={100}
          />
        )}
        <Animated.View
          style={[
            styles.chip,
            {
              // Moment chip — solid hue border + hue-driven glow (no concat tints).
              backgroundColor: c.surface,
              borderColor: hue,
              shadowColor: hue,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.55,
              shadowRadius: 16,
              elevation: 6,
            },
            animatedStyle,
          ]}
        >
          {beat.domain ? <DomainGlyph domain={beat.domain} size={14} color={hue} /> : null}
          <AuroraText variant="bodyLg" numeric color={hue}>
            {`+${beat.amount} XP`}
          </AuroraText>
        </Animated.View>
      </View>
    );
  }

  if (beat.type === 'streakSave') {
    // A banked freeze just rescued this streak. The save must be SEEN —
    // loss aversion only works when the near-loss registers. Shield styling
    // (success hue), no burst: it's relief, not triumph.
    return (
      <View pointerEvents="none" style={styles.wrap}>
        <Animated.View
          style={[
            styles.chip,
            {
              backgroundColor: c.surface,
              borderColor: c.success,
              shadowColor: c.success,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 14,
              elevation: 6,
            },
            animatedStyle,
          ]}
        >
          <AuroraText variant="caption" color={c.success}>
            {`🛡️ Streak saved · ${beat.label} stays at ${beat.count}`}
          </AuroraText>
        </Animated.View>
      </View>
    );
  }

  // Streak beat — small flame label with burst.
  return (
    <View pointerEvents="none" style={styles.wrap}>
      {!engineHandlesBurst && (
        <CelebrationBurst palette={[c.streak, c.warning, c.xp]} count={10} size={6} originTop={100} />
      )}
      <Animated.View
        style={[
          styles.chip,
          {
            backgroundColor: c.surface,
            borderColor: c.streak,
            shadowColor: c.streak,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 14,
            elevation: 6,
          },
          animatedStyle,
        ]}
      >
        <AuroraText variant="caption" color={c.streak}>
          {`🔥 ${beat.label} · ${beat.count}`}
        </AuroraText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 88,
    zIndex: 50,
    pointerEvents: 'none',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
});
