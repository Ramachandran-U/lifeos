import { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { EASING, useMotionScale } from '@/theme/motion';

export interface PulseHaloProps {
  /** Domain color for the rings, e.g. '#00C896'. */
  hue: string;
  /** Breathing cycle in ms (2400-4000). */
  period: number;
  /** Center X position in px. Defaults to screen center. */
  cx?: number;
  /** Center Y position in px. Defaults to screen center. */
  cy?: number;
  /** Max expansion radius in px. Defaults to 80. */
  maxRadius?: number;
}

const SCREEN = Dimensions.get('window');
const RING_BORDER_WIDTH = 1.5;

/** Phase offset for the outer ring relative to the inner ring. */
const OUTER_PHASE_OFFSET = 0.3;

/**
 * A single concentric ring that breathes (scales + opacity).
 */
function HaloRing({
  hue,
  pulseT,
  minRadius,
  maxRadius,
  minOpacity,
  maxOpacity,
  phaseOffset,
}: {
  hue: string;
  pulseT: SharedValue<number>;
  minRadius: number;
  maxRadius: number;
  minOpacity: number;
  maxOpacity: number;
  phaseOffset: number;
}) {
  const diameter = maxRadius * 2;

  const ringStyle = useAnimatedStyle(() => {
    // Apply phase offset: shift pulseT and wrap within 0-1
    const t = (pulseT.value + phaseOffset) % 1;

    const radius = interpolate(t, [0, 1], [minRadius, maxRadius], Extrapolation.CLAMP);
    const opacity = interpolate(t, [0, 1], [maxOpacity, minOpacity], Extrapolation.CLAMP);
    const scale = radius / maxRadius;

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: diameter,
          height: diameter,
          borderRadius: maxRadius,
          borderWidth: RING_BORDER_WIDTH,
          borderColor: hue,
          marginLeft: -maxRadius,
          marginTop: -maxRadius,
        },
        ringStyle,
      ]}
    />
  );
}

/**
 * PulseHalo -- soft expanding rings from a focal point. Used for live-block
 * breathing (4s period) and voice listening (2.4s period).
 *
 * Renders 2 concentric stroke-only rings that breathe (scale + opacity).
 * When motionScale is 0 (reduce-motion or "off"), renders nothing since
 * the pulse is a pure visual enhancement with no informational content.
 */
export function PulseHalo({
  hue,
  period,
  cx,
  cy,
  maxRadius = 80,
}: PulseHaloProps) {
  const motionScale = useMotionScale();
  const pulseT = useSharedValue(0);

  const centerX = cx ?? SCREEN.width / 2;
  const centerY = cy ?? SCREEN.height / 2;

  useEffect(() => {
    if (motionScale === 0) {
      pulseT.value = 0;
      return;
    }
    pulseT.value = 0;
    pulseT.value = withRepeat(
      withTiming(1, { duration: period, easing: EASING.inOut }),
      -1,
      true,
    );
    return () => {
      pulseT.value = 0;
    };
  }, [motionScale, period]);

  // Gate: when motion is off, render nothing.
  if (motionScale === 0) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { left: centerX, top: centerY },
      ]}
    >
      {/* Inner ring: 40-60px, opacity 0.08-0.04 */}
      <HaloRing
        hue={hue}
        pulseT={pulseT}
        minRadius={maxRadius * 0.5}
        maxRadius={maxRadius * 0.75}
        minOpacity={0.04}
        maxOpacity={0.08}
        phaseOffset={0}
      />
      {/* Outer ring: 60-80px, opacity 0.05-0.02 */}
      <HaloRing
        hue={hue}
        pulseT={pulseT}
        minRadius={maxRadius * 0.75}
        maxRadius={maxRadius}
        minOpacity={0.02}
        maxOpacity={0.05}
        phaseOffset={OUTER_PHASE_OFFSET}
      />
    </View>
  );
}
