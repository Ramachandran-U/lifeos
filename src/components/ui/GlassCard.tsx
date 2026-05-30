import { ReactNode } from 'react';
import {
  View,
  ViewProps,
  ViewStyle,
  StyleProp,
  StyleSheet,
  Platform,
  Pressable,
  GestureResponderEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useColors } from '@/theme/colors';
import { useThemeStore } from '@/store/useThemeStore';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import { useElevation, type Elevation } from '@/theme/elevation';

interface GlassCardProps extends ViewProps {
  accent?: string;        // Domain hue — adds left border + top-left glow
  padding?: keyof typeof spacing | number;
  radius?: keyof typeof radii | number;
  elevation?: Elevation;  // z1 default — content card
  style?: StyleProp<ViewStyle>;
  onPress?: (e: GestureResponderEvent) => void;
  children?: ReactNode;
}

// Aurora signature container. Translucent over the screen gradient (dark) or
// a soft white surface (light). Optional `accent` adds the domain-tinted left
// border + corner glow that identifies a card's owning domain.
export function GlassCard({
  accent,
  padding = 'md',
  radius = 'card',
  elevation = 'z1',
  style,
  onPress,
  children,
  ...rest
}: GlassCardProps) {
  const c = useColors();
  const elev = useElevation(elevation);
  const mode = useThemeStore((s) => s.mode);
  const isWeb = Platform.OS === 'web';
  const padValue = typeof padding === 'number' ? padding : spacing[padding];
  const radiusValue = typeof radius === 'number' ? radius : radii[radius];

  const accentBorder: ViewStyle | undefined = accent
    ? {
        borderLeftWidth: 3,
        borderLeftColor: accent,
      }
    : undefined;

  const inner = (
    <View
      style={[
        styles.base,
        elev,
        { borderRadius: radiusValue, padding: padValue },
        // Subtle backdrop-filter on web only.
        isWeb
          ? ({ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } as ViewStyle)
          : null,
        accentBorder,
        style,
      ]}
      {...rest}
    >
      {/* Native frosted-glass backdrop — clipped by the base's rounded overflow.
          z0 (ground) stays unblurred; web uses backdropFilter above instead. */}
      {!isWeb && elevation !== 'z0' ? (
        <BlurView
          intensity={24}
          tint={mode === 'light' ? 'light' : 'dark'}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {accent ? (
        <View
          pointerEvents="none"
          style={[
            styles.accentGlow,
            // Soft radial — web does this with a CSS gradient; native shows
            // a faint flat tint at the top-left.
            Platform.OS === 'web'
              ? ({
                  background: `radial-gradient(ellipse at top left, ${accent}14, transparent 65%)`,
                } as unknown as ViewStyle)
              : { backgroundColor: accent + '08' },
            { borderTopLeftRadius: radiusValue, borderTopRightRadius: radiusValue },
          ]}
        />
      ) : null}
      <View style={styles.content}>{children}</View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        // Aurora Refined v2: soft scale press feedback instead of opacity dip.
        style={({ pressed }) => [
          {
            borderRadius: radiusValue,
            transform: [{ scale: pressed ? 0.985 : 1 }],
            opacity: pressed ? 0.96 : 1,
          },
        ]}
        accessibilityRole="button"
      >
        {inner}
      </Pressable>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    position: 'relative',
  },
  accentGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 70,
  },
  content: {
    position: 'relative',
  },
});
