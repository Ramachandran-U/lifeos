import { View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { useColors } from '@/theme/colors';
import { DOMAIN_META } from '@/constants/gamification';
import type { DomainKey } from '@/constants/gamification';

interface Props {
  scores: Record<DomainKey, number>;
  /** Prior-day snapshot — green dashed outline behind today for day-over-day shape. */
  priorScores?: Record<DomainKey, number> | null;
  size?: number;
}

export function HexRadar({ scores, priorScores, size = 340 }: Props) {
  const c = useColors();
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.34;
  const rings = [0.25, 0.5, 0.75, 1.0];
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

  const dataPathFor = (src: Record<DomainKey, number>) =>
    DOMAIN_META.map((d, i) => {
      const s = (src[d.key] ?? 0) / 100;
      const p = pt(d.angleDeg, maxR * Math.max(0.02, s));
      return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    }).join(' ') + 'Z';

  const dataPath = dataPathFor(scores);
  const priorPath = priorScores ? dataPathFor(priorScores) : null;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {rings.map((pctR, i) => (
          <Path
            key={i}
            d={hexPath(pctR)}
            fill={i === 3 ? c.primary + '10' : 'none'}
            stroke={c.border}
            strokeWidth={i === 3 ? 1.5 : 1}
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
        {priorPath && (
          <Path
            d={priorPath}
            fill={c.success}
            fillOpacity={0.06}
            stroke={c.success}
            strokeWidth={2}
            strokeOpacity={0.85}
            strokeDasharray="6,4"
          />
        )}
        <Path d={dataPath} fill={c.primary} fillOpacity={0.18} stroke={c.primary} strokeWidth={2} />
      </Svg>
    </View>
  );
}
