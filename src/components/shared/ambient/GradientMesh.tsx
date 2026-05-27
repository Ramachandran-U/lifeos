import { useEffect, useRef } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
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
  stops: GradientMeshStop[];
  period: number;
}

// ── Native path: large blurred Views ────────────────────────────────────
const NATIVE_ORB_SIZE = 420;
const NATIVE_ORB_RADIUS = NATIVE_ORB_SIZE / 2;
const NATIVE_ORBIT_AMP = 40;

function NativeMeshOrb({
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
    if (motionScale === 0) return {};
    const angle = meshT.value * Math.PI * 2 + phase;
    return {
      transform: [
        { translateX: Math.sin(angle) * NATIVE_ORBIT_AMP },
        { translateY: Math.cos(angle * 0.7) * NATIVE_ORBIT_AMP * 0.6 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: NATIVE_ORB_SIZE,
          height: NATIVE_ORB_SIZE,
          borderRadius: NATIVE_ORB_RADIUS,
          backgroundColor: stop.color,
          opacity: stop.opacity,
          left: `${stop.cx * 100}%`,
          top: `${stop.cy * 100}%`,
          marginLeft: -NATIVE_ORB_RADIUS,
          marginTop: -NATIVE_ORB_RADIUS,
        },
        orbitStyle,
      ]}
    />
  );
}

// ── Web path: CSS radial-gradients on a single div ──────────────────────
// React Native Web clips `filter: blur()` to the element bounding box,
// making blurred circles look like squares. Instead, render a single div
// whose `background` is multiple layered radial-gradients — the same
// technique the base aurora uses, but with animated positions.
const WEB_ORBIT_PCT = 8;

function WebGradientMesh({ stops, meshT, motionScale }: { stops: GradientMeshStop[]; meshT: SharedValue<number>; motionScale: number }) {
  const meshStyle = useAnimatedStyle(() => {
    const gradients = stops.map((s, i) => {
      const phase = i * 2.1;
      let cxPct = s.cx * 100;
      let cyPct = s.cy * 100;
      if (motionScale > 0) {
        const angle = meshT.value * Math.PI * 2 + phase;
        cxPct += Math.sin(angle) * WEB_ORBIT_PCT;
        cyPct += Math.cos(angle * 0.7) * WEB_ORBIT_PCT * 0.6;
      }
      const r = Math.round(35 + i * 5);
      const rgba = hexToRgba(s.color, s.opacity);
      return `radial-gradient(${r}% ${r}% at ${cxPct.toFixed(1)}% ${cyPct.toFixed(1)}%, ${rgba}, transparent 70%)`;
    });
    return { backgroundImage: gradients.join(', ') } as Record<string, unknown>;
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, right: 0, top: -60, bottom: -60 }, meshStyle]}
    />
  );
}

function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

// ── Public component ────────────────────────────────────────────────────

export function GradientMesh({ stops, period }: GradientMeshProps) {
  const motionScale = useMotionScale();
  const meshT = useSharedValue(0);

  useEffect(() => {
    if (motionScale === 0) { meshT.value = 0; return; }
    meshT.value = 0;
    meshT.value = withRepeat(
      withTiming(1, { duration: period, easing: EASING.inOut }),
      -1,
      true,
    );
    return () => { meshT.value = 0; };
  }, [motionScale, period]);

  const isWeb = Platform.OS === 'web';

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {isWeb ? (
        <WebGradientMesh stops={stops} meshT={meshT} motionScale={motionScale} />
      ) : (
        stops.map((stop, i) => (
          <NativeMeshOrb key={i} stop={stop} index={i} meshT={meshT} motionScale={motionScale} />
        ))
      )}
    </View>
  );
}
