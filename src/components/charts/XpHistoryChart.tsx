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
  /** Per-day XP totals, oldest → newest (see getXpDailyTotals). */
  data: { day: string; xp: number }[];
  testID?: string;
}

/**
 * Daily XP earned, from the xp_events ledger (M4, flag: animatedCharts).
 * Animated Skia bars on native once the lazy victory chunk lands; the static
 * Sparkline everywhere else (flag off, web-pending, Expo Go, load failure).
 */
export function XpHistoryChart({ data, testID }: Props) {
  const c = useColors();
  const flagOn = isEnabled('animatedCharts');
  const loadState = useSyncExternalStore(subscribeChartsLoad, getChartsLoadState, getChartsLoadState);

  useEffect(() => {
    if (flagOn) beginChartsLoad();
  }, [flagOn]);

  const sparkSeries = useMemo(() => {
    const xs = data.map((d) => d.xp);
    return xs.length >= 2 ? xs : [0, xs[0] ?? 0];
  }, [data]);

  const impl = flagOn && loadState === 'ready' ? getChartsImpl() : null;
  if (!impl) {
    return <Sparkline data={sparkSeries} color={c.xp} width={280} height={CHART_HEIGHT.spark} testID={testID} />;
  }

  const { XpHistoryImpl } = impl;
  return <XpHistoryImpl data={data} palette={chartPalette(c, c.xp)} height={CHART_HEIGHT.standard} />;
}
