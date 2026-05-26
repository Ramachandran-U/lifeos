import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, {
  Polygon,
  Line,
  Circle,
  Text as SvgText,
  Defs,
  RadialGradient,
  Stop,
  G,
} from 'react-native-svg';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Caption, Label } from '@/components/ui/Typography';

interface Scores {
  goals: number;
  health: number;
  finance: number;
  career: number;
  social: number;
  polymath: number;
}

interface LifeBalanceDashboardProps {
  scores: Scores;
}

// ─── Domain config ────────────────────────────────────────────────────────────

const DOMAIN_KEYS: (keyof Scores)[] = [
  'goals', 'health', 'finance', 'career', 'social', 'polymath',
];

const DOMAIN_META: Record<keyof Scores, { label: string; colorKey: string }> = {
  goals:    { label: 'Goals',   colorKey: 'goal'     },
  health:   { label: 'Health',  colorKey: 'health'   },
  finance:  { label: 'Finance', colorKey: 'finance'  },
  career:   { label: 'Career',  colorKey: 'career'   },
  social:   { label: 'Social',  colorKey: 'social'   },
  polymath: { label: 'Mind',    colorKey: 'polymath' },
};

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function pt(index: number, total: number, r: number, cx: number, cy: number) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function poly(points: { x: number; y: number }[]) {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LifeBalanceDashboard({ scores }: LifeBalanceDashboardProps) {
  const c = useColors();
  const { width: screenWidth } = useWindowDimensions();

  // Make the SVG fill the card width minus padding
  const svgSize = Math.min(screenWidth - spacing.xl * 2 - spacing.md * 2, 420);
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const R = svgSize * 0.30;          // outermost ring radius
  const LABEL_R = R + svgSize * 0.13; // label orbit

  const n = DOMAIN_KEYS.length;
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0];

  const domainColors = DOMAIN_KEYS.map(
    (k) => (c as Record<string, string>)[DOMAIN_META[k].colorKey],
  );

  const outerPts  = DOMAIN_KEYS.map((_, i) => pt(i, n, R, cx, cy));
  const labelPts  = DOMAIN_KEYS.map((_, i) => pt(i, n, LABEL_R, cx, cy));
  const dataPts   = DOMAIN_KEYS.map((k, i) => pt(i, n, (scores[k] / 100) * R, cx, cy));

  // Overall score for centre display
  const avg = Math.round(
    DOMAIN_KEYS.reduce((s, k) => s + scores[k], 0) / DOMAIN_KEYS.length,
  );

  return (
    <View style={[styles.container, { backgroundColor: c.card, borderColor: c.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Label style={{ color: c.textPrimary }}>Life Balance</Label>
          <Caption style={{ color: c.textMuted }}>Your 6-dimension score</Caption>
        </View>
        {avg > 0 && (
          <View style={[styles.avgBadge, { backgroundColor: c.primaryLight }]}>
            <Body style={[styles.avgNumber, { color: c.primary }]}>{avg}</Body>
            <Caption style={{ color: c.primary }}>avg</Caption>
          </View>
        )}
      </View>

      {/* Chart */}
      <View style={styles.chartWrap}>
        <Svg width={svgSize} height={svgSize}>
          <Defs>
            {/* Radial gradient for filled area */}
            <RadialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%"   stopColor={c.primary} stopOpacity="0.55" />
              <Stop offset="100%" stopColor={c.primary} stopOpacity="0.08" />
            </RadialGradient>

            {/* Per-domain dot glows */}
            {DOMAIN_KEYS.map((k, i) => (
              <RadialGradient key={k} id={`glow${i}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0%"   stopColor={domainColors[i]} stopOpacity="0.9" />
                <Stop offset="100%" stopColor={domainColors[i]} stopOpacity="0"   />
              </RadialGradient>
            ))}
          </Defs>

          {/* ── Background rings ── */}
          {rings.map((ratio, ri) => {
            const ringPts = DOMAIN_KEYS.map((_, i) => pt(i, n, R * ratio, cx, cy));
            const isOuter = ri === rings.length - 1;
            return (
              <Polygon
                key={ri}
                points={poly(ringPts)}
                fill={ri % 2 === 0 ? c.surfaceAlt : 'transparent'}
                fillOpacity={0.35}
                stroke={c.border}
                strokeWidth={isOuter ? 1.5 : 0.8}
                strokeOpacity={isOuter ? 0.7 : 0.4}
              />
            );
          })}

          {/* ── Ring % labels (20, 40, 60, 80) ── */}
          {[0.2, 0.4, 0.6, 0.8].map((ratio) => {
            const labelY = cy - R * ratio - 4;
            return (
              <SvgText
                key={ratio}
                x={cx + 4}
                y={labelY}
                fontSize={8}
                fontFamily={fonts.body}
                fill={c.textMuted}
                fillOpacity={0.6}
                textAnchor="start"
              >
                {ratio * 100}%
              </SvgText>
            );
          })}

          {/* ── Axis spokes ── */}
          {outerPts.map((endPt, i) => (
            <Line
              key={i}
              x1={cx}
              y1={cy}
              x2={endPt.x}
              y2={endPt.y}
              stroke={c.border}
              strokeWidth={1}
              strokeOpacity={0.5}
              strokeDasharray="3,3"
            />
          ))}

          {/* ── Filled data polygon ── */}
          <Polygon
            points={poly(dataPts)}
            fill="url(#radarGlow)"
            stroke={c.primary}
            strokeWidth={2.5}
            strokeOpacity={0.95}
            strokeLinejoin="round"
          />

          {/* ── Domain dot glows (soft halo) ── */}
          {dataPts.map((dPt, i) => (
            scores[DOMAIN_KEYS[i]] > 0 && (
              <Circle
                key={`halo${i}`}
                cx={dPt.x}
                cy={dPt.y}
                r={10}
                fill={`url(#glow${i})`}
              />
            )
          ))}

          {/* ── Domain dots ── */}
          {dataPts.map((dPt, i) => (
            <G key={`dot${i}`}>
              <Circle
                cx={dPt.x}
                cy={dPt.y}
                r={5.5}
                fill={domainColors[i]}
                stroke={c.card}
                strokeWidth={2}
              />
            </G>
          ))}

          {/* ── Axis labels ── */}
          {labelPts.map((lPt, i) => {
            const dx = lPt.x - cx;
            const dy = lPt.y - cy;
            const anchor = Math.abs(dx) < 10 ? 'middle' : dx > 0 ? 'start' : 'end';
            const score = scores[DOMAIN_KEYS[i]];
            const meta  = DOMAIN_META[DOMAIN_KEYS[i]];

            return (
              <G key={`label${i}`}>
                {/* Domain name */}
                <SvgText
                  x={lPt.x}
                  y={lPt.y + (dy < 0 ? -4 : 14)}
                  textAnchor={anchor}
                  fontSize={11}
                  fontWeight="700"
                  fontFamily={fonts.heading}
                  fill={domainColors[i]}
                  letterSpacing={0.3}
                >
                  {meta.label}
                </SvgText>
                {/* Score */}
                <SvgText
                  x={lPt.x}
                  y={lPt.y + (dy < 0 ? 9 : 27)}
                  textAnchor={anchor}
                  fontSize={10}
                  fontFamily={fonts.body}
                  fill={c.textMuted}
                >
                  {score}%
                </SvgText>
              </G>
            );
          })}

          {/* ── Centre score (only when there is data) ── */}
          {avg > 0 && (
            <G>
              <SvgText
                x={cx}
                y={cy - 6}
                textAnchor="middle"
                fontSize={22}
                fontFamily={fonts.display}
                fill={c.textPrimary}
              >
                {avg}
              </SvgText>
              <SvgText
                x={cx}
                y={cy + 12}
                textAnchor="middle"
                fontSize={9}
                fontFamily={fonts.bodyMedium}
                fill={c.textMuted}
                letterSpacing={1}
              >
                OVERALL
              </SvgText>
            </G>
          )}
        </Svg>
      </View>

      {/* Score pills row */}
      <View style={styles.pillRow}>
        {DOMAIN_KEYS.map((k) => {
          const col = (c as Record<string, string>)[DOMAIN_META[k].colorKey];
          const lightKey = DOMAIN_META[k].colorKey + 'Light';
          const bgCol = (c as Record<string, string>)[lightKey] ?? col + '22';
          return (
            <View key={k} style={[styles.pill, { backgroundColor: bgCol }]}>
              <View style={[styles.pillDot, { backgroundColor: col }]} />
              <Caption style={[styles.pillLabel, { color: col }]}>
                {DOMAIN_META[k].label}
              </Caption>
              {scores[k] > 0 && (
                <Caption style={[styles.pillScore, { color: col }]}>
                  {scores[k]}
                </Caption>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xs,
  },
  avgBadge: {
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  avgNumber: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
  },
  chartWrap: {
    alignItems: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    paddingTop: spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  pillScore: {
    fontSize: 11,
    fontWeight: '800',
  },
});
