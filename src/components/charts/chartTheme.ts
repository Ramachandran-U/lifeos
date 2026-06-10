import type { AppColors } from '@/theme/colors';
import { MOTION_BUDGET } from '@/theme/motion';

/**
 * Chart vocabulary (M4, flag: animatedCharts) — every visual constant the
 * chart components consume, derived from theme tokens. Pure and platform-free
 * so it is unit-testable and shared by the victory impls and the fallbacks.
 */

export interface ChartPalette {
  line: string;
  fill: string;
  grid: string;
  tooltipBg: string;
  tooltipText: string;
}

/** Resolve a chart palette from the theme, led by a domain/series hue. */
export function chartPalette(c: AppColors, hue: string): ChartPalette {
  return {
    line: hue,
    fill: hue + '33', // ~20% alpha area fill — data-centric glass, no neon
    grid: c.border,
    tooltipBg: c.surface,
    tooltipText: c.textPrimary,
  };
}

/** Animation budget for series enter/morph — the progressFill token. */
export const CHART_ANIMATE_MS = MOTION_BUDGET.progressFill;

/** Standard chart heights (4pt grid multiples). */
export const CHART_HEIGHT = { spark: 60, standard: 160, breakdown: 180 } as const;
