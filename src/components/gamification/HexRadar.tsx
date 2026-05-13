// ─── HexRadar ────────────────────────────────────────────────────────────────
// 6-domain hexagonal radar. Concentric rings at 25/50/75/100, axis lines,
// data polygon + dots sized by score. Clickable domain dots for drill-down.
// Mirrors design/lifeos-ui.jsx HexRadar component.

import { View, Pressable, StyleSheet } from 'react-native';
import Svg, {
  Path,
  Line,
  Circle,
  Text as SvgText,
  G,
} from 'react-native-svg';
import { useColors, AppColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { DOMAIN_META, DomainKey, DomainScores } from '@/utils/gamification';

interface HexRadarProps {
  scores: DomainScores;
  size?: number;
  activeDomain?: DomainKey | null;
  onDomainPress?: (key: DomainKey) => void;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

function hexPath(cx: number, cy: number, maxR: number, pct: number): string {
  return (
    DOMAIN_META.map((d, i) => {
      const r = maxR * pct;
      const x = cx + r * Math.cos(toRad(d.angle));
      const y = cy + r * Math.sin(toRad(d.angle));
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ') + 'Z'
  );
}

function dataPath(cx: number, cy: number, maxR: number, scores: DomainScores): string {
  return (
    DOMAIN_META.map((d, i) => {
      const raw = scores[d.key] || 0;
      const s = Math.max(0.02, raw / 100);
      const r = maxR * s;
      const x = cx + r * Math.cos(toRad(d.angle));
      const y = cy + r * Math.sin(toRad(d.angle));
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ') + 'Z'
  );
}

export function HexRadar({ scores, size = 420, activeDomain = null, onDomainPress }: HexRadarProps) {
  const c = useColors();
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.34;
  const labelR = maxR + size * 0.1;
  const rings = [0.25, 0.5, 0.75, 1.0];

  const scoreValues = Object.values(scores);
  const avg = scoreValues.length
    ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length)
    : 0;

  const dotSize = (score: number) => 4 + (score / 100) * 5;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Ring labels (25 / 50 / 75 along the top spoke) */}
        {[25, 50, 75].map((v) => {
          const r = (maxR * v) / 100;
          const x = cx + r * Math.cos(toRad(-90));
          const y = cy + r * Math.sin(toRad(-90));
          return (
            <SvgText
              key={v}
              x={x + 4}
              y={y}
              fontFamily={fonts.body}
              fontSize={10}
              fill={c.textMuted}
            >
              {v}
            </SvgText>
          );
        })}

        {/* Background rings */}
        {rings.map((pct, i) => (
          <Path
            key={i}
            d={hexPath(cx, cy, maxR, pct)}
            fill={i === 3 ? c.primary + '10' : 'none'}
            stroke={c.border}
            strokeWidth={i === 3 ? 1.5 : 1}
            opacity={0.5 + i * 0.1}
          />
        ))}

        {/* Axis spokes */}
        {DOMAIN_META.map((d) => {
          const x = cx + maxR * Math.cos(toRad(d.angle));
          const y = cy + maxR * Math.sin(toRad(d.angle));
          return (
            <Line
              key={d.key}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke={c.border}
              strokeWidth={1}
              opacity={0.35}
            />
          );
        })}

        {/* Data polygon */}
        <Path
          d={dataPath(cx, cy, maxR, scores)}
          fill={c.primary}
          fillOpacity={0.18}
          stroke={c.primary}
          strokeWidth={2}
        />

        {/* Domain dots + halo */}
        {DOMAIN_META.map((d) => {
          const score = scores[d.key] || 0;
          const r = maxR * Math.max(0.02, score / 100);
          const x = cx + r * Math.cos(toRad(d.angle));
          const y = cy + r * Math.sin(toRad(d.angle));
          const color = (c as unknown as Record<string, string>)[d.colorKey] ?? c.primary;
          const isActive = activeDomain === d.key;
          const ds = dotSize(score);
          return (
            <G key={d.key}>
              <Circle
                cx={x}
                cy={y}
                r={ds + 8}
                fill={color}
                opacity={isActive ? 0.3 : 0.15}
              />
              <Circle
                cx={x}
                cy={y}
                r={ds}
                fill={color}
                stroke={isActive ? c.textPrimary : color}
                strokeWidth={isActive ? 2 : 0}
              />
            </G>
          );
        })}

        {/* Domain labels */}
        {DOMAIN_META.map((d) => {
          const x = cx + labelR * Math.cos(toRad(d.angle));
          const y = cy + labelR * Math.sin(toRad(d.angle));
          const score = scores[d.key] || 0;
          const color = (c as unknown as Record<string, string>)[d.colorKey] ?? c.primary;
          return (
            <G key={`lbl-${d.key}`}>
              <SvgText
                x={x}
                y={y - 7}
                textAnchor="middle"
                fontFamily={fonts.bodyMedium}
                fontSize={13}
                fontWeight="600"
                fill={color}
              >
                {d.emoji + ' ' + d.label}
              </SvgText>
              <SvgText
                x={x}
                y={y + 9}
                textAnchor="middle"
                fontFamily={fonts.heading}
                fontSize={14}
                fontWeight="700"
                fill={c.textSecondary}
              >
                {String(score)}
              </SvgText>
            </G>
          );
        })}

        {/* Centre score */}
        <SvgText
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fontFamily={fonts.display}
          fontSize={60}
          fill={c.textPrimary}
        >
          {String(avg)}
        </SvgText>
        <SvgText
          x={cx}
          y={cy + 22}
          textAnchor="middle"
          fontFamily={fonts.body}
          fontSize={13}
          fill={c.textMuted}
        >
          LIFE SCORE
        </SvgText>
      </Svg>

      {/* Invisible hit targets for each dot — RN Svg onPress can be flaky on web */}
      {onDomainPress &&
        DOMAIN_META.map((d) => {
          const score = scores[d.key] || 0;
          const r = maxR * Math.max(0.02, score / 100);
          const x = cx + r * Math.cos(toRad(d.angle));
          const y = cy + r * Math.sin(toRad(d.angle));
          const hit = 22;
          return (
            <Pressable
              key={`hit-${d.key}`}
              accessibilityRole="button"
              accessibilityLabel={`${d.label} domain, score ${score}`}
              onPress={() => onDomainPress(d.key)}
              style={[
                hitStyles.hit,
                {
                  left: x - hit / 2,
                  top: y - hit / 2,
                  width: hit,
                  height: hit,
                },
              ]}
            />
          );
        })}
    </View>
  );
}

const hitStyles = StyleSheet.create({
  hit: {
    position: 'absolute',
    borderRadius: 999,
  },
});

// Export helper so parent components can share palette lookup easily
export function domainColor(c: AppColors, key: DomainKey): string {
  const meta = DOMAIN_META.find((d) => d.key === key);
  if (!meta) return c.primary;
  return (c as unknown as Record<string, string>)[meta.colorKey] ?? c.primary;
}
