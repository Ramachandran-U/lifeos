import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { CartesianChart, Line, Area, Bar, PolarChart, Pie, useChartPressState } from 'victory-native';
import { Circle } from '@shopify/react-native-skia';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { haptic } from '@/utils/haptics';
import { CHART_ANIMATE_MS } from './chartTheme';
import type { BreakdownImplProps, TrendImplProps, XpHistoryImplProps } from './victoryImpl.types';

/**
 * victory-native chart impls (M4). NEVER import this module statically — it
 * enters the app exclusively through lazyCharts' single dynamic import, so
 * the Skia-backed chart stack stays out of the boot bundle (see lazySkia for
 * the __common-hoisting failure mode this prevents).
 *
 * One chart canvas per screen: each impl owns exactly one CartesianChart /
 * PolarChart, and host screens mount at most one animated chart at a time.
 */

/** Press-tooltip readout + selection haptic shared by the cartesian charts. */
function useTooltipReadout(
  isActive: boolean,
  value: { value: number } | undefined,
  format: (v: number) => string,
) {
  const [readout, setReadout] = useState<string | null>(null);

  useAnimatedReaction(
    () => value?.value ?? null,
    (v) => {
      runOnJS(setReadout)(v === null || !isActive ? null : format(v));
    },
    [isActive, format],
  );
  useEffect(() => {
    if (isActive) haptic.selection();
    if (!isActive) setReadout(null);
  }, [isActive]);

  return readout;
}

export function XpHistoryImpl({ data, palette, height }: XpHistoryImplProps) {
  const { state, isActive } = useChartPressState({ x: '', y: { xp: 0 } });
  const readout = useTooltipReadout(isActive, state.y.xp.value as { value: number }, (v) => `${Math.round(v)} XP`);

  return (
    <View>
      <ChartReadout text={readout} color={palette.line} />
      <View style={{ height }}>
        <CartesianChart
          data={data}
          xKey="day"
          yKeys={['xp']}
          domainPadding={{ left: spacing.md, right: spacing.md, top: spacing.sm }}
          chartPressState={state}
        >
          {({ points, chartBounds }) => (
            <Bar
              points={points.xp}
              chartBounds={chartBounds}
              color={palette.line}
              roundedCorners={{ topLeft: spacing.xs, topRight: spacing.xs }}
              innerPadding={0.35}
              animate={{ type: 'timing', duration: CHART_ANIMATE_MS }}
            />
          )}
        </CartesianChart>
      </View>
    </View>
  );
}

export function TrendImpl({ points, palette, height, formatValue }: TrendImplProps) {
  const { state, isActive } = useChartPressState({ x: 0, y: { y: 0 } });
  const readout = useTooltipReadout(
    isActive,
    state.y.y.value as { value: number },
    formatValue ?? ((v) => `${Math.round(v * 10) / 10}`),
  );

  return (
    <View>
      <ChartReadout text={readout} color={palette.line} />
      <View style={{ height }}>
        <CartesianChart
          data={points}
          xKey="x"
          yKeys={['y']}
          domainPadding={{ top: spacing.md, bottom: spacing.sm }}
          chartPressState={state}
        >
          {({ points: p, chartBounds }) => (
            <>
              <Area
                points={p.y}
                y0={chartBounds.bottom}
                color={palette.fill}
                curveType="natural"
                animate={{ type: 'timing', duration: CHART_ANIMATE_MS }}
              />
              <Line
                points={p.y}
                color={palette.line}
                strokeWidth={2.5}
                curveType="natural"
                animate={{ type: 'timing', duration: CHART_ANIMATE_MS }}
              />
              {isActive && (
                <Circle cx={state.x.position} cy={state.y.y.position} r={5} color={palette.line} />
              )}
            </>
          )}
        </CartesianChart>
      </View>
    </View>
  );
}

export function BreakdownImpl({ slices, height }: BreakdownImplProps) {
  return (
    <View style={{ height }}>
      <PolarChart data={slices} labelKey="label" valueKey="value" colorKey="color">
        <Pie.Chart innerRadius="62%" />
      </PolarChart>
    </View>
  );
}

function ChartReadout({ text, color }: { text: string | null; color: string }) {
  return (
    <View style={styles.readoutRow}>
      {text ? <Text style={[styles.readout, { color }]}>{text}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  readoutRow: { minHeight: 18, alignItems: 'flex-end' },
  readout: { fontFamily: fonts.heading, fontSize: fontSizes.sm },
});
