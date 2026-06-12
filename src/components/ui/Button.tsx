import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleSheet, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { usePressScale } from '@/hooks/usePressScale';
import { Body } from './Typography';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'xp';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  /**
   * REQUIRED — violet voice ruling (founder, 2026-06-14): violet means "the
   * brand or the AI is speaking", never "this is a button". The Aurora-era
   * silent `primary` default is removed so every call site declares its
   * voice: `primary` (brand/AI), `xp` (gamification gold), `danger`,
   * `secondary`/`ghost` (neutral ink).
   */
  variant: ButtonVariant;
  style?: ViewStyle;
  /** Shows a spinner beside the label, dims the button, and blocks presses. */
  loading?: boolean;
  /** Optional progress copy shown (with the spinner) while loading. Falls back to `title`. */
  loadingTitle?: string;
  /** Leading/trailing element (e.g. an icon) rendered alongside the label. */
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
}

export function Button({
  title,
  variant,
  style,
  onPress,
  loading = false,
  loadingTitle,
  icon,
  iconPosition = 'left',
  disabled,
  ...props
}: ButtonProps) {
  const c = useColors();

  // Ink + Signal §A.3: filled controls take onPrimary ink (white literals
  // failed AA on the new fills); secondary is neutral — violet is the brand
  // signal, not a button chrome (violet policy §A.4).
  const variantStyles: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
    primary: { bg: c.primary, text: c.onPrimary },
    secondary: { bg: 'transparent', text: c.textPrimary, border: c.border },
    ghost: { bg: 'transparent', text: c.textSecondary },
    danger: { bg: c.error, text: c.onPrimary },
    // Gamification voice — xp gold. onPrimary is per-mode correct: near-black
    // ink on the bright dark-mode gold, white on the deep light-mode gold.
    xp: { bg: c.xp, text: c.onPrimary },
  };
  const v = variantStyles[variant];
  const isInteractive = !disabled && !loading;

  // Spring-based press scale — Brilliant-style physical depth feedback.
  const { onPressIn, onPressOut, animatedStyle: scaleStyle } = usePressScale(0.97);

  const handlePressIn = () => {
    if (!isInteractive) return;
    onPressIn();
  };

  const handlePressOut = () => {
    onPressOut();
  };

  const handlePress = (e: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
    if (!isInteractive) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onPress?.(e);
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!isInteractive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      {...props}
    >
      <Animated.View
        style={[
          styles.base,
          {
            backgroundColor: v.bg,
            borderColor: v.border ?? 'transparent',
            borderWidth: v.border ? 1.5 : 0,
            opacity: !isInteractive ? 0.45 : 1,
          },
          style,
          scaleStyle,
        ]}
      >
        <Animated.View style={styles.content}>
          {loading && <ActivityIndicator size="small" color={v.text} />}
          {!loading && icon && iconPosition === 'left' ? icon : null}
          <Body style={[styles.label, { color: v.text }]}>
            {loading && loadingTitle ? loadingTitle : title}
          </Body>
          {!loading && icon && iconPosition === 'right' ? icon : null}
        </Animated.View>
      </Animated.View>
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
