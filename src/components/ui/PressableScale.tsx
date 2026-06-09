import type { ReactNode } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressScale } from '@/hooks/usePressScale';

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  children: ReactNode;
  /** Target press scale — controls compress to 0.97, larger card surfaces to a
   *  gentler 0.98 (default), proportional to size. */
  scaleTo?: number;
  /** Style applied to the inner scaled view (e.g. layout/margins for the wrapper). */
  style?: StyleProp<ViewStyle>;
}

/**
 * Pressable with the shared spring press-scale baked in (Aurora Refined v2 —
 * DELTA Phase 10). Wrap any tappable surface — a Card, a list row, a section
 * header — to get the physical compression feedback without re-wiring
 * `usePressScale` + an `Animated.View` at each call site. Honors reduce-motion
 * for free via `usePressScale`. Forwards all PressableProps (onPress, hitSlop,
 * accessibility*, disabled, …).
 */
export function PressableScale({
  children,
  scaleTo = 0.98,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const press = usePressScale(scaleTo);
  return (
    <Pressable
      onPressIn={(e: GestureResponderEvent) => {
        press.onPressIn();
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        press.onPressOut();
        onPressOut?.(e);
      }}
      {...rest}
    >
      <Animated.View style={[style, press.animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
