import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { EASING, useMotionScale } from '@/theme/motion';

export interface GradientMeshStop {
  color: string;
  cx: number;
  cy: number;
  opacity: number;
}

export interface GradientMeshProps {
  /** Color stops that define the mesh. Each becomes a large blurred orb. */
  stops: GradientMeshStop[];
  /** Full rotation cycle in ms (18000-30000). */
  period: number;
}

const ORB_SIZE = 420;
const ORB_RADIUS = ORB_SIZE / 2;
const ORBIT_AMP = 40;
const BLUR_RADIUS = 120;

/**
 * A single mesh orb: a large blurred circle that orbits on an elliptical
 * path defined by its index-based phase offset.
 */
function MeshOrb({
  stop,
  index,
  meshT,
  motionScale,
}: {
  stop: GradientMeshStop;
  index: number;
  meshT: SharedValue<number>;
  motionScale: number;
}) {
  const phase = index * 2.1;

  const orbitStyle = useAnimatedStyle(() => {
    if (motionScale === 0) {
      return {
        transform: [{ translateX: 0 }, { translateY: 0 }],
      };
    }
    const angle = meshT.value * Math.PI * 2 + phase;
    const dx = Math.sin(angle) * ORBIT_AMP * 0.08 * ORB_SIZE;
    const dy = Math.cos(angle * 0.7) * ORBIT_AMP * 0.08 * ORB_SIZE;
    return {
      transform: [
        { translateX: interpolate(dx, [-ORBIT_AMP, ORBIT_AMP], [-ORBIT_AMP, ORBIT_AMP], Extrapolation.CLAMP) },
        { translateY: interpolate(dy, [-ORBIT_AMP, ORBIT_AMP], [-ORBIT_AMP, ORBIT_AMP], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: ORB_SIZE,
          height: ORB_SIZE,
          borderRadius: ORB_RADIUS,
          backgroundColor: stop.color,
          opacity: stop.opacity,
          left: `${stop.cx * 100}%`,
          top: `${stop.cy * 100}%`,
          marginLeft: -ORB_RADIUS,
          marginTop: -ORB_RADIUS,
          filter: `blur(${BLUR_RADIUS}px)`,
        } as Record<string, unknown>,
        orbitStyle,
      ]}
    />
  );
}

/**
 * GradientMesh -- slow "lava-lamp" gradient rotation rendered as overlapping
 * blurred orbs. This is the primary atmospheric layer that sits behind all
 * content to make the background feel alive.
 *
 * Each stop becomes a large soft circle that orbits on an elliptical path
 * with different phase offsets so they mix and blend slowly.
 */
export function GradientMesh({ stops, period }: GradientMeshProps) {
  const motionScale = useMotionScale();
  const meshT = useSharedValue(0);

  useEffect(() => {
    if (motionScale === 0) {
      meshT.value = 0;
      return;
    }
    meshT.value = 0;
    meshT.value = withRepeat(
      withTiming(1, { duration: period, easing: EASING.inOut }),
      -1,
      true,
    );
    return () => {
      meshT.value = 0;
    };
  }, [motionScale, period]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {stops.map((stop, i) => (
        <MeshOrb
          key={i}
          stop={stop}
          index={i}
          meshT={meshT}
          motionScale={motionScale}
        />
      ))}
    </View>
  );
}
