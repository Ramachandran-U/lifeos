import { View, StyleSheet, useWindowDimensions } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { useSurfaces } from '@/theme/surfaces';
import { useColors } from '@/theme/colors';
import { ParticleField } from './ambient/ParticleField';
import { EnergySweep } from './ambient/EnergySweep';
import { useAmbientState } from './ambient/useAmbientState';
import { useAmbientEventStore } from './ambient/useAmbientEventStore';

interface InkCanvasProps {
  /** Accepted-and-ignored for one release — the wash's parallax died with it,
   *  so existing call sites stay a one-line swap. */
  scrollY?: SharedValue<number>;
  allBlocksDone?: boolean;
  voiceActive?: boolean;
}

// The only background primitive (Ink + Signal, Cluster 3 §B). True-black ink
// at rest — no gradient, no bloom, no mesh, no time-of-day branch. The two
// surviving ambient layers are EVENT language ("Celebrate moments, rest
// quiet"): the energy sweep (event-driven, self-clearing) and the particle
// field in its two earned states (day-complete, voice). Web and native render
// identically by construction.
export function InkCanvas({ scrollY: _scrollY, allBlocksDone, voiceActive }: InkCanvasProps) {
  const surfaces = useSurfaces();
  const c = useColors();
  const { height } = useWindowDimensions();
  const { particles } = useAmbientState({ allBlocksDone, voiceActive });

  const sweep = useAmbientEventStore((s) => s.sweep);
  const clearSweep = useAmbientEventStore((s) => s.clearSweep);

  return (
    <View
      pointerEvents="none"
      testID="ink-canvas"
      style={[StyleSheet.absoluteFill, { backgroundColor: surfaces.ground, overflow: 'hidden' }]}
    >
      {particles && (
        <View testID="ambient-particles" style={StyleSheet.absoluteFill}>
          <ParticleField count={particles.count} hues={particles.hues} height={height} />
        </View>
      )}
      <View testID="ambient-sweep" style={StyleSheet.absoluteFill}>
        <EnergySweep
          hue={sweep?.hue ?? c.primary}
          active={sweep !== null}
          onComplete={clearSweep}
        />
      </View>
    </View>
  );
}
