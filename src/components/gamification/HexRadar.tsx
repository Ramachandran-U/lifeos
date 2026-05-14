import { Pressable } from 'react-native';
import Svg, { Circle, Line, Path, G } from 'react-native-svg';
import { useColors } from '@/theme/colors';
import { DOMAIN_META } from '@/constants/gamification';
import type { DomainKey } from '@/constants/gamification';

interface Props {
  scores: Record<DomainKey, number>;
  /** Optional snapshot of yesterday's scores — drawn as a faint outline behind today's. */
  yesterdayScores?: Record<DomainKey, number> | null;
  size?: number;
  activeDomain?: DomainKey | null;
  onDomainPress?: (key: DomainKey) => void;
}

export function HexRadar({ scores, yesterdayScores, size = 340, activeDomain, onDomainPress }: Props) {
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

  return (
    <Pressable disabled style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
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
        <Path
          d={dataPath}
          fill={c.primary}
          fillOpacity={0.14}
          stroke={c.primary}
          strokeWidth={1.25}
          strokeLinejoin="round"
        />
        {DOMAIN_META.map((d) => {
          const score = scores[d.key] ?? 0;
          const yScore = yesterdayScores?.[d.key];
          const improved = yScore != null && score > yScore;
          const pos = pt(d.angleDeg, maxR * Math.max(0.02, score / 100));
          const dotColor = improved ? c.success : c[d.colorKey];
          const isActive = activeDomain === d.key;
          const r = 3;
          return (
            <G key={d.key} onPress={() => onDomainPress?.(d.key)}>
              {isActive && (
                <Circle cx={pos.x} cy={pos.y} r={r + 5} fill="none" stroke={dotColor} strokeWidth={1.25} opacity={0.6} />
              )}
              <Circle
                cx={pos.x}
                cy={pos.y}
                r={r}
                fill={dotColor}
                stroke={isActive ? c.background : dotColor}
                strokeWidth={isActive ? 1.5 : 0}
              />
            </G>
          );
        })}
      </Svg>
    </Pressable>
  );
}
