export const colors = {
  // Brand
  primary: '#5B4FE8',
  primaryLight: '#EDE9FF',

  // Module colours
  goal: '#FF6B35',
  goalLight: '#FFF0EB',
  health: '#00C896',
  healthLight: '#E0FBF4',
  finance: '#F0B429',
  financeLight: '#FFFBEB',
  career: '#5B4FE8',
  careerLight: '#EDE9FF',
  social: '#FF4D8B',
  socialLight: '#FFE8F2',
  polymath: '#00B4D8',
  polymathLight: '#E0F8FF',

  // Neutrals
  background: '#0D0D0D',
  surface: '#1A1A2E',
  surfaceAlt: '#16213E',
  card: '#1F1F3A',
  border: '#2E2E4A',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A8A8C0',
  textMuted: '#6B6B88',

  // Semantic
  success: '#00C896',
  warning: '#F0B429',
  error: '#FF4444',

  // Gamification
  xp: '#FFD700',
  streak: '#FF6B35',
  badge: '#A855F7',
} as const;

export type ColorToken = keyof typeof colors;
