import { Pressable } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText, G } from 'react-native-svg';
import { useColors } from '@/theme/colors';
import { DOMAIN_META } from '@/constants/gamification';
import type { DomainKey } from '@/constants/gamification';

interface Props {
  scores: Record<DomainKey, number>;
  size?: number;
  activeDomain?: DomainKey | null;
  onDomainPress?: (key: DomainKey) => void;
}

export function HexRadar({ scores, size = 340, activeDomain, onDomainPress }: Props) {
  const c = useColors();
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.34;
  const labelR = maxR + size * 0.1;
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

  const dataPath =
    DOMAIN_META.map((d, i) => {
      const s = (scores[d.key] ?? 0) / 100;
      const p = pt(d.angleDeg, maxR * Math.max(0.02, s));
      return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    }).join(' ') + 'Z';

  return (
    <Pressable disabled style={{ width: size, height: size }}>
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
        <Path d={dataPath} fill={c.primary} fillOpacity={0.18} stroke={c.primary} strokeWidth={2} />
        {DOMAIN_META.map((d) => {
          const score = scores[d.key] ?? 0;
          const pos = pt(d.angleDeg, maxR * Math.max(0.02, score / 100));
          const color = c[d.colorKey];
          const isActive = activeDomain === d.key;
          const r = 4 + (score / 100) * 5;
          return (
            <G key={d.key} onPress={() => onDomainPress?.(d.key)}>
              <Circle cx={pos.x} cy={pos.y} r={r + 8} fill={color} opacity={0.15 + (isActive ? 0.15 : 0)} />
              <Circle
                cx={pos.x}
                cy={pos.y}
                r={r}
                fill={color}
                stroke={isActive ? '#fff' : color}
                strokeWidth={isActive ? 2 : 0}
              />
            </G>
          );
        })}
        {DOMAIN_META.map((d) => {
          const pos = pt(d.angleDeg, labelR);
          const score = scores[d.key] ?? 0;
          const color = c[d.colorKey];
          return (
            <G key={d.key + '_lbl'}>
              <SvgText
                x={pos.x}
                y={pos.y - 4}
                textAnchor="middle"
                fontFamily="Nunito"
                fontSize={12}
                fill={color}
                fontWeight="600"
              >
                {d.emoji} {d.label}
              </SvgText>
              <SvgText
                x={pos.x}
                y={pos.y + 12}
                textAnchor="middle"
                fontFamily="Nunito"
                fontSize={13}
                fill={c.textSecondary}
                fontWeight="700"
              >
                {score}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </Pressable>
  );
}
