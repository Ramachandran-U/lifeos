/**
 * Animated Aurora background — three domain-hue blobs drifting on out-of-phase
 * loops, designed for the marketing surfaces (auth, welcome). Builds on the
 * static AuroraBackground's palette but adds slow, organic motion.
 *
 * Inspiration: 2026 "Aurora UI" trend — soft mesh gradients, glassmorphism
 * over flowing color, particle drift. See e.g.
 *   - https://www.digitalupward.com/blog/2026-web-design-trends-glassmorphism-micro-animations-ai-magic/
 *   - https://gezar.dk/en/blog/web-design-trends-2026
 *
 * Performance notes:
 * - Web uses CSS keyframe animations on absolutely-positioned blurred divs.
 *   Browsers composite this on the GPU; minimal JS frame cost.
 * - Native uses Reanimated shared values driving translateX/translateY +
 *   scale. Worklets run on the UI thread.
 * - Respects `useMotionScale()` — reduce-motion users get the static
 *   AuroraBackground rendering (no animation).
 */

import { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useThemeStore } from '@/store/useThemeStore';
import { useMotionScale } from '@/theme/motion';
import { AuroraBackground } from './AuroraBackground';

interface AnimatedBloom {
  color: string;
  size: number;
  /** Centre x and y as 0-1 within the viewport (we offset from this). */
  cx: number;
  cy: number;
  /** Horizontal + vertical drift amplitude in viewport units (0-1). */
  driftX: number;
  driftY: number;
  /** Loop period in milliseconds. Slightly out-of-phase periods read organic. */
  periodMs: number;
  opacity: number;
}

const DARK_BLOOMS: AnimatedBloom[] = [
  { color: '#A584FF', size: 620, cx: 0.15, cy: 0.10, driftX: 0.18, driftY: 0.12, periodMs: 18_000, opacity: 0.55 },
  { color: '#7FB8FF', size: 520, cx: 0.85, cy: 0.30, driftX: 0.15, driftY: 0.18, periodMs: 22_000, opacity: 0.45 },
  { color: '#FF99C5', size: 560, cx: 0.40, cy: 0.85, driftX: 0.22, driftY: 0.14, periodMs: 16_000, opacity: 0.38 },
  { color: '#5BD9B8', size: 420, cx: 0.75, cy: 0.78, driftX: 0.13, driftY: 0.16, periodMs: 20_000, opacity: 0.28 },
];

const LIGHT_BLOOMS: AnimatedBloom[] = DARK_BLOOMS.map((b) => ({ ...b, opacity: b.opacity * 0.35 }));

// CSS keyframes injected once on web. Reanimated's worklets work on web too,
// but for marketing-tier idle motion a pure-CSS path is cheaper (no JS frame
// cost) and looks identical.
const CSS_KEYFRAMES = `
@keyframes aurora-drift-a {
  0%   { transform: translate(-12%, -8%) scale(1); }
  50%  { transform: translate(8%, 10%) scale(1.08); }
  100% { transform: translate(-12%, -8%) scale(1); }
}
@keyframes aurora-drift-b {
  0%   { transform: translate(10%, -12%) scale(1.05); }
  50%  { transform: translate(-8%, 12%) scale(0.95); }
  100% { transform: translate(10%, -12%) scale(1.05); }
}
@keyframes aurora-drift-c {
  0%   { transform: translate(-10%, 8%) scale(0.95); }
  50%  { transform: translate(14%, -10%) scale(1.10); }
  100% { transform: translate(-10%, 8%) scale(0.95); }
}
@keyframes aurora-drift-d {
  0%   { transform: translate(12%, 10%) scale(1.02); }
  50%  { transform: translate(-12%, -8%) scale(0.92); }
  100% { transform: translate(12%, 10%) scale(1.02); }
}
`;

const CSS_ANIMATION_NAMES = ['aurora-drift-a', 'aurora-drift-b', 'aurora-drift-c', 'aurora-drift-d'];

function ensureCssInjected() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('aurora-animated-keyframes')) return;
  const style = document.createElement('style');
  style.id = 'aurora-animated-keyframes';
  style.innerHTML = CSS_KEYFRAMES;
  document.head.appendChild(style);
}

interface AnimatedBlobProps {
  bloom: AnimatedBloom;
  cssAnimationName: string;
}

function AnimatedBlobNative({ bloom }: AnimatedBlobProps) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    const ease = Easing.bezier(0.4, 0, 0.2, 1);
    tx.value = withRepeat(
      withTiming(bloom.driftX, { duration: bloom.periodMs, easing: ease }),
      -1,
      true, // reverse — gives smooth back-and-forth
    );
    ty.value = withRepeat(
      withTiming(bloom.driftY, { duration: bloom.periodMs * 1.13, easing: ease }),
      -1,
      true,
    );
    scale.value = withRepeat(
      withTiming(1.08, { duration: bloom.periodMs * 0.86, easing: ease }),
      -1,
      true,
    );
  }, [tx, ty, scale, bloom.driftX, bloom.driftY, bloom.periodMs]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value * bloom.size },
      { translateY: ty.value * bloom.size },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: bloom.size,
          height: bloom.size,
          borderRadius: bloom.size / 2,
          backgroundColor: bloom.color,
          opacity: bloom.opacity,
        },
        style,
      ]}
    />
  );
}

function AnimatedBlobWeb({ bloom, cssAnimationName }: AnimatedBlobProps) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: bloom.size,
          height: bloom.size,
          borderRadius: bloom.size / 2,
          backgroundColor: bloom.color,
          opacity: bloom.opacity,
        },
        // Inline CSS for blur + animation. Cast through unknown — RN's
        // ViewStyle doesn't include web-only filter / animation properties.
        ({
          filter: 'blur(60px)',
          WebkitFilter: 'blur(60px)',
          animation: `${cssAnimationName} ${bloom.periodMs}ms cubic-bezier(0.4, 0, 0.2, 1) infinite`,
          willChange: 'transform',
        } as unknown as object),
      ]}
    />
  );
}

export function AuroraAnimatedBackground() {
  const mode = useThemeStore((s) => s.mode);
  const motionScale = useMotionScale();

  ensureCssInjected();

  // Reduce-motion / motion=off → fall back to the static gradient.
  if (motionScale === 0) {
    return <AuroraBackground />;
  }

  const blooms = mode === 'light' ? LIGHT_BLOOMS : DARK_BLOOMS;
  const baseColor = mode === 'light' ? '#F7F4FC' : '#0A0612';

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: baseColor, overflow: 'hidden' }]}
    >
      {blooms.map((b, i) => {
        // Anchor the blob's centre at (cx, cy) of the viewport. We use percent
        // for portability across screen sizes; the drift translates from there.
        const positionStyle = {
          top: `${b.cy * 100}%` as unknown as number,
          left: `${b.cx * 100}%` as unknown as number,
          // Pre-shift by half the size so cx/cy define the CENTRE, not the
          // top-left corner. Translate handles this via marginLeft/Top.
          marginLeft: -b.size / 2,
          marginTop: -b.size / 2,
        };
        return (
          <View key={i} style={[positionStyle, { position: 'absolute' }]}>
            {Platform.OS === 'web' ? (
              <AnimatedBlobWeb bloom={b} cssAnimationName={CSS_ANIMATION_NAMES[i % CSS_ANIMATION_NAMES.length]!} />
            ) : (
              <AnimatedBlobNative bloom={b} cssAnimationName={CSS_ANIMATION_NAMES[i % CSS_ANIMATION_NAMES.length]!} />
            )}
          </View>
        );
      })}
    </View>
  );
}
