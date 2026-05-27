import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { EASING, useMotionScale } from '@/theme/motion';

interface EnergySweepProps {
  hue: string;
  active: boolean;
  onComplete?: () => void;
}

const SWEEP_DURATION = 2200;
const BAND_HEIGHT = 200;

export function EnergySweep({ hue, active, onComplete }: EnergySweepProps) {
  const motionScale = useMotionScale();
  const sweepT = useSharedValue(0);
  const prevActive = useRef(false);

  useEffect(() => {
    // Detect false → true transition
    if (active && !prevActive.current) {
      if (motionScale === 0) {
        // Skip animation, fire callback immediately
        onComplete?.();
      } else {
        sweepT.value = 0;
        sweepT.value = withTiming(1, { duration: SWEEP_DURATION, easing: EASING.out }, (finished) => {
          if (finished && onComplete) {
            runOnJS(onComplete)();
          }
        });
      }
    }
    prevActive.current = active;
  }, [active, motionScale]);

  const animatedStyle = useAnimatedStyle(() => {
    const t = sweepT.value;

    // Opacity: 0 → 0.12 (first 30%) → 0.12 (middle) → 0 (last 30%)
    let opacity: number;
    if (t < 0.3) {
      opacity = (t / 0.3) * 0.12;
    } else if (t > 0.7) {
      opacity = ((1 - t) / 0.3) * 0.12;
    } else {
      opacity = 0.12;
    }

    // Rise from bottom to above container top
    // At t=0 the band bottom edge is at container bottom
    // At t=1 the band top edge has cleared the container top
    // We don't know container height so use 120% travel — percentage-based
    const translateYPercent = (1 - t) * 120;

    return {
      opacity,
      transform: [{ translateY: -translateYPercent * 8 }], // approximate px travel
    };
  });

  if (motionScale === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View
        style={[
          styles.band,
          { backgroundColor: hue, height: BAND_HEIGHT },
          animatedStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -BAND_HEIGHT, // start below container
  },
});
