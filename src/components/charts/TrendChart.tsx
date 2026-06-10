import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { isEnabled } from '@/config/flags';
import { useColors } from '@/theme/colors';
import { Sparkline } from '@/components/gamification/Sparkline';
import { chartPalette, CHART_HEIGHT } from './chartTheme';
import {
  beginChartsLoad,
  getChartsImpl,
  getChartsLoadState,
  subscribeChartsLoad,
} from './lazyCharts';

interface Props {
  /** Series values, oldest → newest (x is the index). */
  values: number[];
  /** Theme hue for the series (e.g. colors.health). */
  hue: string;
  /** Tooltip formatter, e.g. (v) => `${v.toFixed(1)} kg`. */
  formatValue?: (v: number) => string;
  testID?: string;
}

/**
 * Generic metric trend (M4, flag: animatedCharts) — weight, sleep, recovery.
 * Animated Skia line+area with press tooltip on native; Sparkline fallback
 * everywhere else.
 */
export function TrendChart({ values, hue, formatValue, testID }: Props) {
  const c = useColors();
  const flagOn = isEnabled('animatedCharts');
  const loadState = useSyncExternalStore(subscribeChartsLoad, getChartsLoadState, getChartsLoadState);

  useEffect(() => {
    if (flagOn) beginChartsLoad();
  }, [flagOn]);

  const points = useMemo(() => values.map((y, x) => ({ x, y })), [values]);
  const sparkSeries = values.length >= 2 ? values : [0, values[0] ?? 0];

  const impl = flagOn && loadState === 'ready' ? getChartsImpl() : null;
  if (!impl || points.length < 2) {
    return <Sparkline data={sparkSeries} color={hue} width={280} height={CHART_HEIGHT.spark} testID={testID} />;
  }

  const { TrendImpl } = impl;
  return (
    <TrendImpl
      points={points}
      palette={chartPalette(c, hue)}
      height={CHART_HEIGHT.standard}
      formatValue={formatValue}
    />
  );
}
