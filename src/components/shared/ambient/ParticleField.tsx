import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { AMBIENT, useMotionScale } from '@/theme/motion';

interface ParticleFieldProps {
  count: number;
  hues: string[];
  height: number;
}

interface ParticleConfig {
  x: number;       // percentage 10-90
  hue: string;
  size: number;    // 3-5
  duration: number; // 6000-8000
  delay: number;
}

function seededRandom(seed: number): number {
  // Simple deterministic pseudo-random for stable layouts
  const x = Math.sin(seed * 9301 + 49297) * 49271;
  return x - Math.floor(x);
}

function useParticleConfigs(count: number, hues: string[]): ParticleConfig[] {
  return useMemo(() => {
    const configs: ParticleConfig[] = [];
    for (let i = 0; i < count; i++) {
      const r0 = seededRandom(i * 7 + 1);
      const r1 = seededRandom(i * 7 + 2);
      const r2 = seededRandom(i * 7 + 3);
      const r3 = seededRandom(i * 7 + 4);
      const r4 = seededRandom(i * 7 + 5);
      configs.push({
        x: 10 + r0 * 80,
        hue: hues[Math.floor(r1 * hues.length) % hues.length],
        size: 5 + r2 * 5,
        duration: AMBIENT.fieldDrift + r3 * 2000,
        delay: r4 * 8000,
      });
    }
    return configs;
  }, [count, hues]);
}

function Particle({
  config,
  height,
}: {
  config: ParticleConfig;
  height: number;
}) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withDelay(
      config.delay,
      withRepeat(
        withTiming(1, { duration: config.duration, easing: Easing.linear }),
        -1, // infinite
        false,
      ),
    );
  }, [config.delay, config.duration]);

  const animatedStyle = useAnimatedStyle(() => {
    const t = progress.value;

    // Rise from bottom to top
    const translateY = height * (1 - t) - 20 * t;

    // Horizontal sway
    const translateX = Math.sin(t * Math.PI * 2) * 8;

    // Opacity: sine curve — fade in first 20%, full 60%, fade out last 20%
    let opacity: number;
    if (t < 0.2) {
      opacity = t / 0.2;
    } else if (t > 0.8) {
      opacity = (1 - t) / 0.2;
    } else {
      opacity = 1;
    }

    return {
      transform: [{ translateX }, { translateY }],
      opacity: opacity * 0.35,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: `${config.x}%` as unknown as number,
          bottom: 0,
          width: config.size,
          height: config.size,
          borderRadius: 999,
          backgroundColor: config.hue,
        },
        animatedStyle,
      ]}
    />
  );
}

export function ParticleField({ count, hues, height }: ParticleFieldProps) {
  const motionScale = useMotionScale();
  const configs = useParticleConfigs(count, hues);

  if (motionScale === 0) return null;

  return (
    <View style={[styles.container, { height }]} pointerEvents="none">
      {configs.map((config, i) => (
        <Particle key={i} config={config} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
