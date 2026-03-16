import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';

interface TypographyProps extends TextProps {
  color?: string;
}

export function Heading({ style, color, ...props }: TypographyProps) {
  return (
    <RNText
      style={[styles.heading, color ? { color } : undefined, style]}
      {...props}
    />
  );
}

export function Display({ style, color, ...props }: TypographyProps) {
  return (
    <RNText
      style={[styles.display, color ? { color } : undefined, style]}
      {...props}
    />
  );
}

export function Body({ style, color, ...props }: TypographyProps) {
  return (
    <RNText
      style={[styles.body, color ? { color } : undefined, style]}
      {...props}
    />
  );
}

export function Label({ style, color, ...props }: TypographyProps) {
  return (
    <RNText
      style={[styles.label, color ? { color } : undefined, style]}
      {...props}
    />
  );
}

export function Caption({ style, color, ...props }: TypographyProps) {
  return (
    <RNText
      style={[styles.caption, color ? { color } : undefined, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  display: {
    fontFamily: fonts.display,
    fontSize: fontSizes.display,
    color: colors.textPrimary,
  },
  heading: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xxl,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
});
