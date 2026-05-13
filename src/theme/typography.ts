import { Platform, TextStyle } from 'react-native';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';

export function useAppFonts() {
  return useFonts({
    'Nunito-Regular': Nunito_400Regular,
    'Nunito-Bold': Nunito_700Bold,
    'Nunito-ExtraBold': Nunito_800ExtraBold,
    'Nunito-Black': Nunito_900Black,
    'DMSans-Regular': DMSans_400Regular,
    'DMSans-Medium': DMSans_500Medium,
    'DMSans-Bold': DMSans_700Bold,
  });
}

// Monospace stack. Aurora mandates JetBrains Mono for eyebrows / timestamps / XP
// deltas. We use the system mono chain on web until @expo-google-fonts/jetbrains-mono
// is added — UI rhythm depends on tabular figures, not the specific face.
export const MONO_FAMILY = Platform.select({
  web: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
})!;

export const fonts = {
  display: 'Nunito-Black',
  heading: 'Nunito-Bold',
  subheading: 'Nunito-ExtraBold',
  body: 'DMSans-Regular',
  bodyMedium: 'DMSans-Medium',
  bodyBold: 'DMSans-Bold',
  mono: MONO_FAMILY,
} as const;

export const fontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  display: 38,
  hero: 48,
} as const;

// ─── Named text variants (Aurora Refined) ────────────────────────────────────
// Use via <Text variant="..."> — each variant pairs family + weight + size +
// line-height + letter-spacing so callers never re-derive rhythm.

export type TextVariant =
  | 'hero'
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bodyLg'
  | 'body'
  | 'caption'
  | 'micro';

export const textVariants: Record<TextVariant, TextStyle> = {
  hero: {
    fontFamily: 'Nunito-Black',
    fontSize: 48,
    lineHeight: 50,
    letterSpacing: -0.5,
  },
  display: {
    fontFamily: 'Nunito-Black',
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -0.4,
  },
  h1: {
    fontFamily: 'Nunito-Black',
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.2,
  },
  h2: {
    fontFamily: 'Nunito-ExtraBold',
    fontSize: 22,
    lineHeight: 26,
  },
  h3: {
    fontFamily: 'Nunito-ExtraBold',
    fontSize: 18,
    lineHeight: 22,
  },
  bodyLg: {
    fontFamily: 'Nunito-Bold',
    fontSize: 16,
    lineHeight: 22,
  },
  body: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontFamily: 'DMSans-Medium',
    fontSize: 12,
    lineHeight: 16,
  },
  micro: {
    fontFamily: MONO_FAMILY,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
} as const;

// Tabular numerals — apply on counters so digit width never shifts.
// React Native supports fontVariant: ['tabular-nums'] on iOS/Android.
export const TABULAR_NUMS: TextStyle = { fontVariant: ['tabular-nums'] };
