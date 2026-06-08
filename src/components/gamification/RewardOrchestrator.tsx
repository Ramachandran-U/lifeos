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
import { useMotionScale } from '@/theme/motion';
import { usePreferencesStore } from '@/store/usePreferencesStore';

// Mounted once at the root. Drains the reward queue with the Aurora
// choreography — currently the XP chip beat. Badge toasts and level-up
// overlays continue to be rendered by AchievementToast / LevelUpOverlay
// (this orchestrator does not replace them).

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

  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    if (motionScale === 0) {
      // Reduce-motion: still show the chip briefly so the reward registers.
      opacity.value = withSequence(
        withTiming(1, { duration: 0 }),
        withDelay(800, withTiming(0, { duration: 120 }, () => runOnJS(complete)())),
      );
      return;
    }
    // Aurora XP beat: scale-in + rise, hold, fade up.
    const rise = 300 / motionScale;
    const hold = 600 / motionScale;
    const fade = 300 / motionScale;
    opacity.value = withSequence(
      withTiming(1, { duration: rise, easing: Easing.out(Easing.cubic) }),
      withDelay(hold, withTiming(0, { duration: fade, easing: Easing.in(Easing.cubic) },
        (finished) => { if (finished) runOnJS(complete)(); })),
    );
    translateY.value = withSequence(
      withTiming(-12, { duration: rise, easing: Easing.out(Easing.cubic) }),
      withDelay(hold, withTiming(-28, { duration: fade, easing: Easing.in(Easing.cubic) })),
    );
    scale.value = withTiming(1, { duration: rise, easing: Easing.out(Easing.back(1.4)) });

    if (Platform.OS !== 'web') {
      // Streak beats get a satisfying Heavy "thud"; XP beats stay Light.
      const style = beat.type === 'streak'
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Light;
      Haptics.impactAsync(style).catch(() => undefined);
    }
  }, [beat.id, beat.type, motionScale, opacity, translateY, scale, complete]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  // Celebration burst fires on peak moments only: streak hits and big XP gains.
  const showBurst = beat.type === 'streak' || (beat.type === 'xp' && beat.amount >= 50);

  if (beat.type === 'xp') {
    const hue = beat.domain ? (c as Record<string, string>)[beat.domain] : c.xp;
    return (
      <View pointerEvents="none" style={styles.wrap}>
        {showBurst && <CelebrationBurst palette={[hue, c.xp, c.primaryLight]} />}
        <Animated.View
          style={[
            styles.chip,
            {
              backgroundColor: c.xp + '22',
              borderColor: c.xp + '55',
            },
            animatedStyle,
          ]}
        >
          {beat.domain ? <DomainGlyph domain={beat.domain} size={13} color={hue} /> : null}
          <AuroraText variant="bodyLg" numeric color={c.xp}>
            {`+${beat.amount} XP`}
          </AuroraText>
        </Animated.View>
      </View>
    );
  }

  // Streak beat — small flame label. Renders subtly; complete drains.
  return (
    <View pointerEvents="none" style={styles.wrap}>
      {showBurst && <CelebrationBurst palette={[c.streak, c.warning, c.xp]} />}
      <Animated.View
        style={[
          styles.chip,
          { backgroundColor: c.streak + '22', borderColor: c.streak + '55' },
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
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
