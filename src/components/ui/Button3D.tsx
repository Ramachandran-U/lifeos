import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/theme/colors';
import { useSpringConfig } from '@/theme/motion';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Body } from './Typography';

/**
 * Button3D — Brilliant/Duolingo-style tactile button with a physical "press
 * down" feel. (Design-enhancements spike; see docs/research/ui-ux-gamification-2026.md §2.)
 *
 * Technique (the cross-platform-reliable one from the research): a solid darker
 * RIM layer sits behind the FACE, which is lifted by `depth` px. Pressing
 * animates the face DOWN by `depth` (pure `translateY`) so it covers the rim —
 * reading as a real button depression. Transform-only → 60fps, no layout
 * recalculation, and renders identically on iOS / Android / react-native-web
 * (unlike `boxShadow` inset, whose web parity the research flagged as unverified).
 *
 * Honors reduce-motion / motion-intensity for free via `useSpringConfig` (the
 * spring collapses to a near-instant overdamped landing when motion is off).
 */

type Button3DTone =
  | 'primary'
  | 'goal'
  | 'health'
  | 'finance'
  | 'career'
  | 'social'
  | 'polymath'
  | 'success'
  | 'danger'
  | 'xp';

interface Button3DProps extends Omit<PressableProps, 'style'> {
  title: string;
  /**
   * REQUIRED — violet voice ruling (founder, 2026-06-14): violet means "the
   * brand or the AI is speaking", never "this is a button". The Aurora-era
   * silent `primary` default is removed so every call site declares its
   * voice: `primary` (brand/AI), a domain tone, `xp` (gamification gold),
   * `success`, or `danger`. The rim is auto-derived (darker) from the face.
   */
  tone: Button3DTone;
  /** Rim height in px — how "tall" the button sits off the surface. */
  depth?: number;
  /** Shows a spinner beside the label, dims the button, and blocks presses. */
  loading?: boolean;
  /** Optional progress copy shown (with the spinner) while loading. Falls back to `title`. */
  loadingTitle?: string;
  /** Leading/trailing element (e.g. an icon) rendered alongside the label. */
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  /** Stretch to fill the available width. */
  fullWidth?: boolean;
  /** Layout-only style applied to the wrapper (margins/alignment/width). */
  style?: ViewStyle;
}

const TONE_TO_TOKEN: Record<Button3DTone, 'primary' | 'goal' | 'health' | 'finance' | 'career' | 'social' | 'polymath' | 'success' | 'error' | 'xp'> = {
  primary: 'primary',
  goal: 'goal',
  health: 'health',
  finance: 'finance',
  career: 'career',
  social: 'social',
  polymath: 'polymath',
  success: 'success',
  danger: 'error',
  xp: 'xp',
};

/** Mix a solid #RRGGBB hex toward black by `ratio` (0–1). Returns input unchanged
 *  for non-hex (e.g. rgba) values, so it degrades safely. */
function darken(hex: string, ratio: number): string {
  const m = hex.replace('#', '');
  if (m.length !== 6 || /[^0-9a-fA-F]/.test(m)) return hex;
  const n = parseInt(m, 16);
  const k = 1 - ratio;
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function Button3D({
  title,
  tone,
  depth = 6,
  loading = false,
  loadingTitle,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  ...props
}: Button3DProps) {
  const c = useColors();
  const isInteractive = !disabled && !loading;

  const faceColor = c[TONE_TO_TOKEN[tone]];
  const rimColor = darken(faceColor, 0.28);
  // Domain hues are bright in both modes → inkOnColor; brand/danger/xp fills
  // are per-mode → onPrimary (light primary and the deep light-mode xp gold
  // are too dark for near-black ink).
  const labelColor = tone === 'primary' || tone === 'danger' || tone === 'xp' ? c.onPrimary : c.inkOnColor;

  // 0 = at rest (face lifted, rim showing), 1 = fully pressed (face covers rim).
  const pressed = useSharedValue(0);
  const springCfg = useSpringConfig('snappy');

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * depth }],
  }));

  const handlePressIn = (e: GestureResponderEvent) => {
    if (!isInteractive) return;
    pressed.value = withSpring(1, springCfg);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    pressed.value = withSpring(0, springCfg);
    onPressOut?.(e);
  };

  const handlePress = (e: GestureResponderEvent) => {
    if (!isInteractive) return;
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
      style={[fullWidth && styles.fullWidth, style]}
      {...props}
    >
      <View style={[styles.wrapper, { opacity: isInteractive ? 1 : 0.45 }]}>
        {/* Rim — the solid darker "edge" the face lifts off of. */}
        <View
          style={[styles.rim, { backgroundColor: rimColor, borderRadius: radii.control }]}
        />
        {/* Face — lifted by `depth` (marginBottom reserves the rim strip so
            layout stays stable when it translates down on press). */}
        <Animated.View
          style={[
            styles.face,
            { backgroundColor: faceColor, borderRadius: radii.control, marginBottom: depth },
            faceStyle,
          ]}
        >
          <View style={styles.content}>
            {loading && <ActivityIndicator size="small" color={labelColor} />}
            {!loading && icon && iconPosition === 'left' ? icon : null}
            <Body style={[styles.label, { color: labelColor }]}>
              {loading && loadingTitle ? loadingTitle : title}
            </Body>
            {!loading && icon && iconPosition === 'right' ? icon : null}
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullWidth: {
    alignSelf: 'stretch',
  },
  wrapper: {
    position: 'relative',
  },
  rim: {
    ...StyleSheet.absoluteFillObject,
  },
  face: {
    minHeight: 56,
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
