import { useThemeStore } from '@/store/useThemeStore';

// ─── Module colours (same in both themes) ────────────────────────────────────

const MODULE = {
  goal:          '#FF6B35',
  goalLight:     '#FFF0EB',
  health:        '#00C896',
  healthLight:   '#E0FBF4',
  finance:       '#F0B429',
  financeLight:  '#FFFBEB',
  career:        '#5B4FE8',
  careerLight:   '#EDE9FF',
  social:        '#FF4D8B',
  socialLight:   '#FFE8F2',
  polymath:      '#00B4D8',
  polymathLight: '#E0F8FF',
  // Semantic
  success: '#00C896',
  warning: '#F0B429',
  error:   '#FF4444',
  // Gamification
  xp:     '#FFD700',
  streak: '#FF6B35',
  badge:  '#A855F7',
  // Brand
  primary:      '#5B4FE8',
  primaryLight: '#EDE9FF',
} as const;

// ─── Dark palette ─────────────────────────────────────────────────────────────

export const darkColors = {
  ...MODULE,
  background:    '#0D0D0D',
  surface:       '#1A1A2E',
  surfaceAlt:    '#16213E',
  card:          '#1F1F3A',
  border:        '#2E2E4A',
  textPrimary:   '#FFFFFF',
  textSecondary: '#A8A8C0',
  textMuted:     '#6B6B88',
  // Sidebar
  sidebarBg:     '#13131F',
  sidebarBorder: '#2E2E4A',
  overlay:       'rgba(0,0,0,0.6)',
} as const;

// ─── Light palette ────────────────────────────────────────────────────────────

export const lightColors = {
  ...MODULE,
  background:    '#F4F4F8',
  surface:       '#FFFFFF',
  surfaceAlt:    '#EEEEF5',
  card:          '#FFFFFF',
  border:        '#DDD9F0',
  textPrimary:   '#0D0D1A',
  textSecondary: '#4A4A6A',
  textMuted:     '#9090B0',
  // Sidebar
  sidebarBg:     '#FFFFFF',
  sidebarBorder: '#DDD9F0',
  overlay:       'rgba(0,0,0,0.35)',
} as const;

export type AppColors = { [K in keyof typeof darkColors]: string };

// ─── Static export (dark) — for files that don't need reactivity ──────────────
// Components that use StyleSheet.create() outside of render must use useColors()
// inside the render function. For the few places that reference colors statically
// (tab layout, splash), we export the dark palette as the default.
export const colors: AppColors = darkColors;

export type ColorToken = keyof AppColors;

// ─── Reactive hook ────────────────────────────────────────────────────────────

export function useColors(): AppColors {
  const mode = useThemeStore((s) => s.mode);
  return mode === 'light' ? lightColors : darkColors;
}
