import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
} from 'react-native-reanimated';
import { EASING, useMotionScale } from '@/theme/motion';

// A radial particle burst for celebration peak moments (streak hits, big XP).
// Pure Reanimated — particles shoot outward evenly, arc down under "gravity",
// and fade. Skipped entirely under reduce-motion. Render it keyed by the event
// id so a fresh mount fires a fresh burst, and place it behind the reward chip.

interface Props {
  /** Colours cycled across particles. */
  palette: readonly string[];
  count?: number;
  size?: number;
  /** Vertical offset of the burst origin from the top of the parent. */
  originTop?: number;
}

export function CelebrationBurst({ palette, count = 12, size = 8, originTop = 104 }: Props) {
  const motionScale = useMotionScale();
  if (motionScale === 0) return null; // reduce-motion: no burst

  return (
    <View pointerEvents="none" style={[styles.layer, { top: originTop }]}>
      <View style={styles.origin}>
        {Array.from({ length: count }).map((_, i) => (
          <Particle
            key={i}
            index={i}
            count={count}
            color={palette[i % palette.length]}
            size={size}
            motionScale={motionScale}
          />
        ))}
      </View>
    </View>
  );
}

function Particle({
  index,
  count,
  color,
  size,
  motionScale,
}: {
  index: number;
  count: number;
  color: string;
  size: number;
  motionScale: number;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    const dur = (ms: number) => ms / motionScale;
    const angle = (index / count) * Math.PI * 2;
    const dist = 54 + (index % 3) * 16; // staggered radius: 54 / 70 / 86
    const ox = Math.cos(angle) * dist;
    const oy = Math.sin(angle) * dist;

    tx.value = withTiming(ox, { duration: dur(640), easing: EASING.out });
    ty.value = withSequence(
      withTiming(oy, { duration: dur(280), easing: EASING.out }),
      withTiming(oy + 48, { duration: dur(420), easing: EASING.inOut }), // gravity
    );
    scale.value = withTiming(0.35, { duration: dur(700), easing: EASING.out });
    opacity.value = withDelay(dur(280), withTiming(0, { duration: dur(420), easing: EASING.out }));
    // Fire once on mount — the component is keyed by event id upstream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: -size / 2,
          top: -size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  origin: {
    width: 0,
    height: 0,
  },
});
