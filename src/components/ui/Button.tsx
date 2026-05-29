import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleSheet, View, ViewStyle } from 'react-native';
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
  /** Shows a spinner beside the label, dims the button, and blocks presses. */
  loading?: boolean;
  /** Leading/trailing element (e.g. an icon) rendered alongside the label. */
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
}

export function Button({
  title,
  variant = 'primary',
  style,
  onPress,
  loading = false,
  icon,
  iconPosition = 'left',
  disabled,
  ...props
}: ButtonProps) {
  const c = useColors();
  const variantStyles: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
    primary: { bg: c.primary, text: '#FFFFFF' },
    secondary: { bg: 'transparent', text: c.primary, border: c.primary },
    ghost: { bg: 'transparent', text: c.textSecondary },
    danger: { bg: c.error, text: '#FFFFFF' },
  };
  const v = variantStyles[variant];
  const isInteractive = !disabled && !loading;

  const handlePress = (e: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
    if (!isInteractive) return;
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
          opacity: !isInteractive ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      onPress={handlePress}
      disabled={!isInteractive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      {...props}
    >
      <View style={styles.content}>
        {loading && <ActivityIndicator size="small" color={v.text} />}
        {!loading && icon && iconPosition === 'left' ? icon : null}
        <Body style={[styles.label, { color: v.text }]}>{title}</Body>
        {!loading && icon && iconPosition === 'right' ? icon : null}
      </View>
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
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
  },
});
