import { Text as RNText, TextProps } from 'react-native';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';

interface TypographyProps extends TextProps {
  color?: string;
}

export function Heading({ style, color, ...props }: TypographyProps) {
  const c = useColors();
  return (
    <RNText
      style={[
        { fontFamily: fonts.heading, fontSize: fontSizes.xxl, color: color ?? c.textPrimary },
        style,
      ]}
      {...props}
    />
  );
}

export function Display({ style, color, ...props }: TypographyProps) {
  const c = useColors();
  return (
    <RNText
      style={[
        { fontFamily: fonts.display, fontSize: fontSizes.display, color: color ?? c.textPrimary },
        style,
      ]}
      {...props}
    />
  );
}

export function Body({ style, color, ...props }: TypographyProps) {
  const c = useColors();
  return (
    <RNText
      style={[
        { fontFamily: fonts.body, fontSize: fontSizes.md, color: color ?? c.textPrimary },
        style,
      ]}
      {...props}
    />
  );
}

export function Label({ style, color, ...props }: TypographyProps) {
  const c = useColors();
  return (
    <RNText
      style={[
        { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: color ?? c.textSecondary },
        style,
      ]}
      {...props}
    />
  );
}

export function Caption({ style, color, ...props }: TypographyProps) {
  const c = useColors();
  return (
    <RNText
      style={[
        { fontFamily: fonts.body, fontSize: fontSizes.xs, color: color ?? c.textMuted },
        style,
      ]}
      {...props}
    />
  );
}
