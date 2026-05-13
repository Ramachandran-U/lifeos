import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';
import { useColors } from '@/theme/colors';
import { textVariants, TABULAR_NUMS, type TextVariant } from '@/theme/typography';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: string;
  numeric?: boolean;
  muted?: boolean;
  secondary?: boolean;
}

export function Text({
  variant = 'body',
  color,
  numeric,
  muted,
  secondary,
  style,
  ...rest
}: TextProps) {
  const c = useColors();
  const resolved: TextStyle = {
    ...textVariants[variant],
    color:
      color ??
      (muted ? c.textMuted : secondary ? c.textSecondary : c.textPrimary),
    ...(numeric ? TABULAR_NUMS : null),
  };
  return <RNText style={[resolved, style]} {...rest} />;
}
