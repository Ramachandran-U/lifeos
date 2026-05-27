import { Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line, Path, G } from 'react-native-svg';
import { useColors } from '@/theme/colors';
import { DOMAIN_META } from '@/constants/gamification';
import type { DomainKey, ColorKey } from '@/constants/gamification';

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
