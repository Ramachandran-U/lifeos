import { useThemeStore } from '@/store/useThemeStore';

// ─── Ink + Signal palette ────────────────────────────────────────────────────
// Per docs/DESIGN_MANIFESTO.md and the Cluster 3 spec
// (docs/design-deep-dive/03-color-system.md): true-black ink as the resting
// state, six full-saturation domain hues as the ONLY chroma, violet restricted
// to the brand/AI signal (policy §A.4 — five surfaces). The neutral scale
// carries zero hue. Every value below is contrast-locked by
// src/theme/__tests__/contrast.test.ts — changing a pinned hex or threshold
// requires founder sign-off in the PR description.
//
// Rule of use: color ON a surface → `*Text` token; color AS a surface → the
// base hue token. `*Dim` tokens are the only legal tinted fills — the
// `token + 'XX'` alpha-suffix pattern is banned (atmosphereTintCompliance).

export const DOMAIN_GLYPHS = {
  goal:     '◆',
  health:   '♥',
  finance:  '◈',
  career:   '▲',
  social:   '●',
  polymath: '✦',
} as const;

// Domain hues — full saturation, fixed across both themes (text-capable in
// dark mode by construction; light mode reads them through `*Text`).
const DOMAIN_HUES = {
  goal:     '#FF7733',
  health:   '#00D68F',
  finance:  '#FFB300',
  career:   '#4D9FFF',
  social:   '#FF5C97',
  polymath: '#1FC8FF',
  // Near-black ink for content sitting on a bright accent fill (R1 blocks,
  // FAB icons, on-accent labels). Fixed across themes since domain hues are
  // bright in both.
  inkOnColor: '#0B0B0D',
} as const;

// ─── Dark palette (Ink — primary) ────────────────────────────────────────────

export const darkColors = {
  ...DOMAIN_HUES,
  // Surfaces — neutral ink scale, zero hue cast.
  background:    '#000000',
  surface:       '#0E0E12',
  surfaceAlt:    '#17171C',
  card:          '#101014',
  border:        'rgba(255,255,255,0.10)',
  track:         'rgba(255,255,255,0.08)', // progress/XP bar track — the only legal use
  textPrimary:   '#F7F8F8',
  textSecondary: 'rgba(247,248,248,0.72)',
  textMuted:     'rgba(247,248,248,0.58)',
  // Domain hue as TEXT (dark: the hue itself — all clear 4.5:1 on bg + card).
  goalText:     '#FF7733',
  healthText:   '#00D68F',
  financeText:  '#FFB300',
  careerText:   '#4D9FFF',
  socialText:   '#FF5C97',
  polymathText: '#1FC8FF',
  // Dim containers — hue at 14% over black; the only legal tinted fills.
  goalDim:     '#241107',
  healthDim:   '#001E14',
  financeDim:  '#241900',
  careerDim:   '#0B1624',
  socialDim:   '#240D15',
  polymathDim: '#041C24',
  primaryDim:  '#131124',
  // Semantic
  success: '#00D68F',
  warning: '#FFC53D',
  error:   '#FF6166',
  // Gamification — the gold/ember voice (violet voice ruling, founder
  // 2026-06-14: violet is the brand/AI voice, never gamification — the old
  // policy-V5 violet xp #9D8CFF is retired). xp is a bright gold, distinct
  // from the badge/finance gold and the streak ember.
  xp:     '#FFD60A',
  streak: '#FF8C3C',
  badge:  '#FFB300',
  // Brand violet ("Signal") — the one brand accent; see violet policy §A.4.
  primary:   '#8B7CFF',
  onPrimary: '#0B0B0D', // label ink for primary/danger filled controls
  // Sidebar
  sidebarBg:     '#0E0E12',
  sidebarBorder: 'rgba(255,255,255,0.10)',
  overlay:       'rgba(0,0,0,0.72)',
} as const;

// ─── Light palette (kept, re-derived neutral) ────────────────────────────────

export const lightColors = {
  ...DOMAIN_HUES,
  background:    '#F6F7F8',
  surface:       '#FFFFFF',
  surfaceAlt:    '#ECEDEF',
  card:          '#FFFFFF',
  border:        'rgba(11,11,13,0.12)',
  track:         'rgba(11,11,13,0.08)',
  textPrimary:   '#0B0B0D',
  textSecondary: 'rgba(11,11,13,0.72)',
  textMuted:     'rgba(11,11,13,0.60)',
  // Domain hue as TEXT (light: darkened for ≥4.5:1 on white + own dim).
  goalText:     '#B83A00',
  healthText:   '#00734D',
  financeText:  '#8A5800',
  careerText:   '#0B5FD9',
  socialText:   '#C81E5C',
  polymathText: '#00708F',
  // Dim containers (light).
  goalDim:     '#FFEDE3',
  healthDim:   '#DFF8EE',
  financeDim:  '#FFF3D6',
  careerDim:   '#E3EEFF',
  socialDim:   '#FFE4EE',
  polymathDim: '#DFF6FD',
  primaryDim:  '#E9E6FF',
  // Semantic
  success: '#047857',
  warning: '#8A5800',
  error:   '#C2243B',
  // Gamification (light text forms; badge FILLS stay #FFB300 + inkOnColor in
  // both modes). xp leaves the violet family (violet voice ruling, founder
  // 2026-06-14) for the deep gold text form badge/warning already use —
  // ≥ 4.5:1 on white, and onPrimary white clears AA on it as a fill.
  xp:     '#8A5800',
  streak: '#C2410C',
  badge:  '#8A5800',
  // Brand
  primary:   '#5B4FE8',
  onPrimary: '#FFFFFF',
  // Sidebar
  sidebarBg:     '#FFFFFF',
  sidebarBorder: 'rgba(11,11,13,0.12)',
  overlay:       'rgba(11,11,13,0.45)',
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
