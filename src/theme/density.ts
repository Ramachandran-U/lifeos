import { spacing } from './spacing';
import { usePreferencesStore, type DensityMode } from '@/store/usePreferencesStore';

// Density multipliers — affect padding/gaps only. Type, radii, icons unchanged
// so compact mode reads as 'efficient' not 'cramped' (Aurora Refined spec).

export const DENSITY_SCALE: Record<DensityMode, number> = {
  compact: 0.85,
  cozy: 1.0,
  spacious: 1.18,
};

export function useDensityScale(): number {
  const density = usePreferencesStore((s) => s.density);
  return DENSITY_SCALE[density];
}

export function usePad(token: keyof typeof spacing): number {
  const scale = useDensityScale();
  return Math.round(spacing[token] * scale);
}

// Hook variant returning a memoised spacing object scaled by density.
export function useSpacing() {
  const scale = useDensityScale();
  return {
    xs: Math.round(spacing.xs * scale),
    sm: Math.round(spacing.sm * scale),
    md: Math.round(spacing.md * scale),
    lg: Math.round(spacing.lg * scale),
    xl: Math.round(spacing.xl * scale),
    xxl: Math.round(spacing.xxl * scale),
    xxxl: Math.round(spacing.xxxl * scale),
  };
}
