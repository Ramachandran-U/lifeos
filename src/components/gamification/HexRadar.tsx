import { useEffect, useRef } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line, Path, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withSequence,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { EASING } from '@/theme/motion';
import { DOMAIN_META } from '@/constants/gamification';
import type { DomainKey, ColorKey } from '@/constants/gamification';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const DOMAIN_ICONS: Record<ColorKey, keyof typeof Ionicons.glyphMap> = {
  goal:     'flag',
  health:   'barbell',
  finance:  'cash',
  career:   'briefcase',
  social:   'people',
  polymath: 'compass',
};

const ICON_SIZE = 17;

interface Props {
  scores: Record<DomainKey, number>;
  yesterdayScores?: Record<DomainKey, number> | null;
  size?: number;
  activeDomain?: DomainKey | null;
  onDomainPress?: (key: DomainKey) => void;
  pulseKey?: DomainKey;
}

export function HexRadar({ scores, yesterdayScores, size = 340, activeDomain, onDomainPress, pulseKey }: Props) {
  const c = useColors();
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.42;
  const rings = [0.33, 0.66, 1.0];
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const pt = (angle: number, r: number) => ({
    x: cx + r * Math.cos(toRad(angle)),
    y: cy + r * Math.sin(toRad(angle)),
  });

  const hexPath = (pctR: number) =>
    DOMAIN_META.map((d, i) => {
      const p = pt(d.angleDeg, maxR * pctR);
      return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    }).join(' ') + 'Z';

  const scorePath = (src: Record<DomainKey, number>) =>
    DOMAIN_META.map((d, i) => {
      const s = (src[d.key] ?? 0) / 100;
      const p = pt(d.angleDeg, maxR * Math.max(0.02, s));
      return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    }).join(' ') + 'Z';

  const dataPath = scorePath(scores);
  const yesterdayPath = yesterdayScores ? scorePath(yesterdayScores) : null;

  // --- Morph animation: smooth polygon transition when scores change ---
  const prevScoresRef = useRef<Record<DomainKey, number>>(scores);
  const morphP = useSharedValue(1); // 0 = prev shape, 1 = current shape

  // Per-vertex coordinates for prev and current (flat arrays: [x0,y0,x1,y1,...])
  const prevVertices = useSharedValue<number[]>(
    DOMAIN_META.flatMap((d) => {
      const s = (scores[d.key] ?? 0) / 100;
      const r = maxR * Math.max(0.02, s);
      return [cx + r * Math.cos(toRad(d.angleDeg)), cy + r * Math.sin(toRad(d.angleDeg))];
    }),
  );
  const nextVertices = useSharedValue<number[]>(
    DOMAIN_META.flatMap((d) => {
      const s = (scores[d.key] ?? 0) / 100;
      const r = maxR * Math.max(0.02, s);
      return [cx + r * Math.cos(toRad(d.angleDeg)), cy + r * Math.sin(toRad(d.angleDeg))];
    }),
  );

  useEffect(() => {
    // Compute vertices from prev and next scores
    const prev = prevScoresRef.current;
    const pv = DOMAIN_META.flatMap((d) => {
      const s = (prev[d.key] ?? 0) / 100;
      const r = maxR * Math.max(0.02, s);
      return [cx + r * Math.cos(toRad(d.angleDeg)), cy + r * Math.sin(toRad(d.angleDeg))];
    });
    const nv = DOMAIN_META.flatMap((d) => {
      const s = (scores[d.key] ?? 0) / 100;
      const r = maxR * Math.max(0.02, s);
      return [cx + r * Math.cos(toRad(d.angleDeg)), cy + r * Math.sin(toRad(d.angleDeg))];
    });

    prevVertices.value = pv;
    nextVertices.value = nv;
    morphP.value = 0;
    morphP.value = withTiming(1, { duration: 1600, easing: EASING.inOut });

    prevScoresRef.current = scores;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores]);

  const animatedPathProps = useAnimatedProps(() => {
    'worklet';
    const pv = prevVertices.value;
    const nv = nextVertices.value;
    const t = morphP.value;
    let d = '';
    for (let i = 0; i < DOMAIN_META.length; i++) {
      const ix = i * 2;
      const iy = i * 2 + 1;
      const x = interpolate(t, [0, 1], [pv[ix], nv[ix]], Extrapolate.CLAMP);
      const y = interpolate(t, [0, 1], [pv[iy], nv[iy]], Extrapolate.CLAMP);
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)} `;
    }
    d += 'Z';
    return { d };
  });

  // --- Dot pulse animation ---
  const pulseScale = useSharedValue(1);
  const prevPulseKey = useRef<DomainKey | undefined>(undefined);

  useEffect(() => {
    if (pulseKey && pulseKey !== prevPulseKey.current) {
      pulseScale.value = 1;
      pulseScale.value = withSequence(
        withTiming(1.2, { duration: 400, easing: EASING.bounce }),
        withTiming(1, { duration: 400, easing: EASING.bounce }),
      );
    }
    prevPulseKey.current = pulseKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseKey]);

  // Build animated props for each domain dot (position follows morph, radius pulses if active)
  const DOT_R = 3;
  const dotAnimatedProps = DOMAIN_META.map((d, idx) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useAnimatedProps(() => {
      'worklet';
      const t = morphP.value;
      const ix = idx * 2;
      const iy = idx * 2 + 1;
      const pv = prevVertices.value;
      const nv = nextVertices.value;
      const animX = interpolate(t, [0, 1], [pv[ix], nv[ix]], Extrapolate.CLAMP);
      const animY = interpolate(t, [0, 1], [pv[iy], nv[iy]], Extrapolate.CLAMP);
      // Pulse: scale the radius for the pulsing domain's dot
      const isPulse = pulseKey === d.key;
      const r = isPulse ? DOT_R * pulseScale.value : DOT_R;
      return { cx: animX, cy: animY, r };
    });
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {rings.map((pctR, i) => (
          <Path
            key={i}
            d={hexPath(pctR)}
            fill="none"
            stroke={c.border}
            strokeWidth={i === rings.length - 1 ? 1.5 : 1}
            opacity={0.5 + i * 0.1}
          />
        ))}
        {DOMAIN_META.map((d) => {
          const outer = pt(d.angleDeg, maxR);
          return (
            <Line
              key={d.key}
              x1={cx}
              y1={cy}
              x2={outer.x}
              y2={outer.y}
              stroke={c.border}
              strokeWidth={1}
              opacity={0.35}
            />
          );
        })}
        {yesterdayPath && (
          <Path
            d={yesterdayPath}
            fill="none"
            stroke={c.textMuted}
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.4}
          />
        )}
        <AnimatedPath
          animatedProps={animatedPathProps}
          fill={c.primary}
          fillOpacity={0.14}
          stroke={c.primary}
          strokeWidth={1.25}
          strokeLinejoin="round"
        />
        {DOMAIN_META.map((d, idx) => {
          const score = scores[d.key] ?? 0;
          const yScore = yesterdayScores?.[d.key];
          const improved = yScore != null && score > yScore;
          const pos = pt(d.angleDeg, maxR * Math.max(0.02, score / 100));
          const dotColor = improved ? c.success : c[d.colorKey];
          const isActive = activeDomain === d.key;
          return (
            <G key={d.key} onPress={() => onDomainPress?.(d.key)}>
              {isActive && (
                <Circle cx={pos.x} cy={pos.y} r={DOT_R + 5} fill="none" stroke={dotColor} strokeWidth={1.25} opacity={0.6} />
              )}
              <AnimatedCircle
                animatedProps={dotAnimatedProps[idx]}
                fill={dotColor}
                stroke={isActive ? c.background : dotColor}
                strokeWidth={isActive ? 1.5 : 0}
              />
            </G>
          );
        })}
      </Svg>

      {DOMAIN_META.map((d) => {
        const label = pt(d.angleDeg, maxR * 1.12);
        const isActive = activeDomain === d.key;
        const iconColor = d.key === 'career' ? c.textPrimary : c[d.colorKey];
        return (
          <Pressable
            key={`icon-${d.key}`}
            onPress={() => onDomainPress?.(d.key)}
            hitSlop={8}
            style={[
              styles.icon,
              {
                left: label.x - ICON_SIZE / 2,
                top: label.y - ICON_SIZE / 2,
                opacity: isActive ? 1 : 0.75,
              },
            ]}
          >
            <Ionicons name={DOMAIN_ICONS[d.colorKey]} size={ICON_SIZE} color={iconColor} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    position: 'absolute',
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
