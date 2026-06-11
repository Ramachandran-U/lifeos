import { ReactNode } from 'react';
import {
  View,
  ViewProps,
  ViewStyle,
  StyleProp,
  StyleSheet,
  Pressable,
  GestureResponderEvent,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import { useElevation, type Elevation } from '@/theme/elevation';
import { usePressScale } from '@/hooks/usePressScale';

interface GlassCardProps extends ViewProps {
  accent?: string;        // Domain hue — left border (corner glow died in Ink + Signal)
  padding?: keyof typeof spacing | number;
  radius?: keyof typeof radii | number;
  elevation?: Elevation;  // z1 default — content card
  style?: StyleProp<ViewStyle>;
  onPress?: (e: GestureResponderEvent) => void;
  children?: ReactNode;
}

// Ink container — a solid ink surface (elevation token) with a hairline
// border. Blur and accent corner glow died in the Ink + Signal recommit
// (Cluster 3 §A.7). The `accent` left border survives until the W2 structural
// pass removes the prop (R3 glyphs replace edge accents).
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
  const elev = useElevation(elevation);
  const padValue = typeof padding === 'number' ? padding : spacing[padding];
  const radiusValue = typeof radius === 'number' ? radius : radii[radius];
  // Cards compress gently (0.98) vs. a control's 0.97 — proportional to size.
  const press = usePressScale(0.98);

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
        accentBorder,
        style,
      ]}
      {...rest}
    >
      <View style={styles.content}>{children}</View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
      >
        {/* Spring scale press feedback instead of opacity dip. */}
        <Animated.View style={[{ borderRadius: radiusValue }, press.animatedStyle]}>
          {inner}
        </Animated.View>
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
  content: {
    position: 'relative',
  },
});
