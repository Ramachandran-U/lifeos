import { Pressable, PressableProps, StyleSheet, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body } from './Typography';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: ButtonVariant;
  style?: ViewStyle;
}

export function Button({ title, variant = 'primary', style, onPress, ...props }: ButtonProps) {
  const c = useColors();
  const variantStyles: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
    primary: { bg: c.primary, text: '#FFFFFF' },
    secondary: { bg: 'transparent', text: c.primary, border: c.primary },
    ghost: { bg: 'transparent', text: c.textSecondary },
    danger: { bg: c.error, text: '#FFFFFF' },
  };
  const v = variantStyles[variant];

  const handlePress = (e: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.(e);
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border ?? 'transparent',
          borderWidth: v.border ? 1.5 : 0,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
      onPress={handlePress}
      {...props}
    >
      <Body
        style={[
          styles.label,
          { color: v.text },
        ]}
      >
        {title}
      </Body>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  label: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
  },
});
