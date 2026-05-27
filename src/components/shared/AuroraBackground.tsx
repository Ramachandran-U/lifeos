import { useEffect } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useThemeStore } from '@/store/useThemeStore';
import { EASING, useMotionScale } from '@/theme/motion';
import { useAmbientState } from './ambient/useAmbientState';
import { GradientMesh } from './ambient/GradientMesh';
import { PulseHalo } from './ambient/PulseHalo';
import { ParticleField } from './ambient/ParticleField';
import { EnergySweep } from './ambient/EnergySweep';
import { useAmbientEventStore } from './ambient/useAmbientEventStore';
import type { AmbientBloom } from './ambient/presets';

const DRIFT_X_AMP = 12;
const DRIFT_Y_AMP = 8;
const DRIFT_PHASES = [0, 0.8, 1.6];

const DARK_BASE = '#0A0612';
const LIGHT_BASE = '#F7F4FC';

const DEFAULT_MESH_STOPS = [
  { color: '#A584FF', cx: 0.25, cy: 0.2, opacity: 0.22 },
  { color: '#7EE0B8', cx: 0.75, cy: 0.55, opacity: 0.16 },
  { color: '#FF99C5', cx: 0.45, cy: 0.85, opacity: 0.12 },
];

function DriftingBloom({
  bloom,
  phase,
  motionScale,
  period,
}: {
  bloom: AmbientBloom;
  phase: number;
  motionScale: number;
  period: number;
}) {
  const drift = useSharedValue(0);

  useEffect(() => {
    if (motionScale === 0) return;
    drift.value = withRepeat(
      withTiming(1, { duration: period, easing: EASING.inOut }),
      -1,
      true,
    );
    return () => { drift.value = 0; };
  }, [motionScale, period]);

  const driftStyle = useAnimatedStyle(() => {
    if (motionScale === 0) return {};
    const angle = drift.value * Math.PI * 2 + phase;
    return {
      transform: [
        { translateX: Math.sin(angle) * DRIFT_X_AMP },
        { translateY: Math.cos(angle) * DRIFT_Y_AMP },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: bloom.size,
          height: bloom.size,
          borderRadius: bloom.size / 2,
          backgroundColor: bloom.color,
          opacity: bloom.opacity,
          top: bloom.top as number | undefined,
          left: bloom.left as number | undefined,
          right: bloom.right as number | undefined,
          bottom: bloom.bottom as number | undefined,
        },
        driftStyle,
      ]}
    />
  );
}

interface AuroraBackgroundProps {
  blooms?: AmbientBloom[];
  scrollY?: SharedValue<number>;
  liveBlockModule?: string | null;
  allBlocksDone?: boolean;
  voiceActive?: boolean;
}

export function AuroraBackground({
  blooms,
  scrollY,
  liveBlockModule,
  allBlocksDone,
  voiceActive,
}: AuroraBackgroundProps) {
  const mode = useThemeStore((s) => s.mode);
  const isLight = mode === 'light';
  const motionScale = useMotionScale();
  const { height } = useWindowDimensions();
  const { preset, pulse, particles } = useAmbientState({
    liveBlockModule,
    allBlocksDone,
    voiceActive,
  });

  const resolvedBlooms = blooms ?? (isLight ? preset.blooms.light : preset.blooms.dark);
  const baseColor = isLight ? LIGHT_BASE : DARK_BASE;
  const webGradient = isLight ? preset.webGradient.light : preset.webGradient.dark;

  const sweep = useAmbientEventStore((s) => s.sweep);
  const clearSweep = useAmbientEventStore((s) => s.clearSweep);

  const parallax = useAnimatedStyle(() => {
    const y = scrollY ? scrollY.value : 0;
    const t = Math.max(-90, Math.min(0, -y * 0.18));
    return { transform: [{ translateY: t }] };
  });

  const isWeb = Platform.OS === 'web';

  return (
    <View
      pointerEvents="none"
      testID="aurora-bg"
      style={[StyleSheet.absoluteFill, !isWeb && { backgroundColor: baseColor, overflow: 'hidden' }]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, scrollY ? parallax : null]}>
        {/* Layer 0+1: Base canvas + slow orbs */}
        {isWeb ? (
          <View
            style={[
              { position: 'absolute', left: 0, right: 0, top: -120, bottom: -120 },
              { backgroundImage: webGradient } as unknown as object,
            ]}
          />
        ) : (
          resolvedBlooms.map((b, i) => (
            <DriftingBloom
              key={`${preset.id}-${i}`}
              bloom={b}
              phase={DRIFT_PHASES[i % DRIFT_PHASES.length]}
              motionScale={motionScale}
              period={preset.orbPeriod}
            />
          ))
        )}

        {/* Layer 2: Gradient mesh (renders on all platforms) */}
        <View testID="ambient-mesh" style={StyleSheet.absoluteFill}>
          <GradientMesh stops={DEFAULT_MESH_STOPS} period={preset.meshPeriod} />
        </View>

        {/* Layer 3: Particle field (day-complete or voice) */}
        {particles && (
          <View testID="ambient-particles" style={StyleSheet.absoluteFill}>
            <ParticleField count={particles.count} hues={particles.hues} height={height} />
          </View>
        )}

        {/* Layer 4: Energy sweep (event-driven) */}
        <View testID="ambient-sweep" style={StyleSheet.absoluteFill}>
          <EnergySweep
            hue={sweep?.hue ?? '#A584FF'}
            active={sweep !== null}
            onComplete={clearSweep}
          />
        </View>

        {/* Layer 5: Pulse halo (live block or voice) */}
        {pulse && (
          <View testID="ambient-pulse" style={StyleSheet.absoluteFill}>
            <PulseHalo hue={pulse.hue} period={pulse.period} />
          </View>
        )}
      </Animated.View>
    </View>
  );
}
