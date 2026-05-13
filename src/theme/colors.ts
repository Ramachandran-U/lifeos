import { useThemeStore } from '@/store/useThemeStore';

// ─── Aurora Glass palette ────────────────────────────────────────────────────
// Per DESIGN_DOC.md — refined violet-to-black with calibrated domain hues.
// Domains keep hue *and* shape/glyph for color-blind robustness.

export const DOMAIN_GLYPHS = {
  goal:     '◆',
  health:   '♥',
  finance:  '◈',
  career:   '▲',
  social:   '●',
  polymath: '✦',
} as const;

const MODULE = {
  // Aurora domain hues — calibrated at equal perceived lightness
  goal:          '#C9A0FF',
  goalLight:     '#2A1E4A',
  health:        '#7EE0B8',
  healthLight:   '#0F2A22',
  finance:       '#F4C16A',
  financeLight:  '#2A2014',
  career:        '#7FB8FF',
  careerLight:   '#0F1E38',
  social:        '#FF99C5',
  socialLight:   '#2A1420',
  polymath:      '#FFD66B',
  polymathLight: '#2A2014',
  // Semantic
  success: '#31E0A3',
  warning: '#FFC23A',
  error:   '#FF5577',
  // Gamification
  xp:     '#C5B3FF',
  streak: '#FF8C3C',
  badge:  '#C5B3FF',
  // Brand
  primary:      '#A584FF',
  primaryLight: '#C5B3FF',
} as const;

// ─── Dark palette (Aurora Glass — primary) ───────────────────────────────────

export const darkColors = {
  ...MODULE,
  background:    '#0A0612',
  surface:       '#120A1E',
  surfaceAlt:    '#1A1028',
  card:          'rgba(255,255,255,0.04)',
  border:        'rgba(255,255,255,0.08)',
  textPrimary:   '#F4EFFF',
  textSecondary: 'rgba(244,239,255,0.62)',
  textMuted:     'rgba(244,239,255,0.38)',
  // Sidebar
  sidebarBg:     '#120A1E',
  sidebarBorder: 'rgba(255,255,255,0.08)',
  overlay:       'rgba(0,0,0,0.65)',
} as const;

// ─── Light palette ────────────────────────────────────────────────────────────

export const lightColors = {
  ...MODULE,
  // Domain "Light" tints overridden for legibility on a light background —
  // the dark-mode tints (#2A1E4A etc.) are unreadable here.
  goalLight:     '#F1E9FF',
  healthLight:   '#DFF7EC',
  financeLight:  '#FFF1D6',
  careerLight:   '#E1ECFF',
  socialLight:   '#FFE3EE',
  polymathLight: '#FFF1D6',
  primaryLight:  '#E8DEFF',
  background:    '#F7F4FC',
  surface:       '#FFFFFF',
  surfaceAlt:    '#F0EAFA',
  card:          '#FFFFFF',
  border:        'rgba(20,8,40,0.14)',
  textPrimary:   '#140828',
  textSecondary: 'rgba(20,8,40,0.72)',
  textMuted:     'rgba(20,8,40,0.52)',
  // Sidebar
  sidebarBg:     '#FFFFFF',
  sidebarBorder: 'rgba(20,8,40,0.14)',
  overlay:       'rgba(20,8,40,0.45)',
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
