import type { ComponentType } from 'react';
import type { ChartPalette } from './chartTheme';

/**
 * The contract victoryImpl.tsx fulfils — kept in a types-only module so the
 * public chart components and lazyCharts can reference the impl shapes
 * WITHOUT importing the victory module statically (which would pull the
 * whole Skia chart stack into the boot bundle).
 */

export interface XpHistoryImplProps {
  data: { day: string; xp: number }[];
  palette: ChartPalette;
  height: number;
}

export interface TrendImplProps {
  points: { x: number; y: number }[];
  palette: ChartPalette;
  height: number;
  /** Formats the tooltip readout (e.g. (v) => `${v.toFixed(1)} kg`). */
  formatValue?: (v: number) => string;
}

export interface BreakdownImplProps {
  slices: { label: string; value: number; color: string }[];
  height: number;
}

export interface VictoryChartsModule {
  XpHistoryImpl: ComponentType<XpHistoryImplProps>;
  TrendImpl: ComponentType<TrendImplProps>;
  BreakdownImpl: ComponentType<BreakdownImplProps>;
}
