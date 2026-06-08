/**
 * Spring-based press-scale feedback — the "physical compression" interaction
 * (a button/card dips slightly when pressed and springs back on release).
 * Extracted so every tappable surface shares one motion vocabulary instead of
 * each re-implementing opacity dips or ad-hoc scales.
 *
 * Honors reduce-motion for free: `useSpringConfig` collapses to a near-instant
 * overdamped spring when motion intensity is 0, so the scale lands in one frame.
 *
 * Usage — spread the handlers on the Pressable, apply the style to an
 * Animated.View wrapping the visual:
 *
 *   const press = usePressScale();
 *   <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut}>
 *     <Animated.View style={[styles.card, press.animatedStyle]}>…</Animated.View>
 *   </Pressable>
 *
 * Convention: controls (Button) compress to 0.97; larger card surfaces use a
 * gentler 0.98 so the motion reads as proportional to the element's size.
 */
import { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSpringConfig, type SpringToken } from '@/theme/motion';

export function usePressScale(scaleTo = 0.97, token: SpringToken = 'snappy') {
  const scale = useSharedValue(1);
  const springCfg = useSpringConfig(token);

  const onPressIn = () => {
    scale.value = withSpring(scaleTo, springCfg);
  };
  const onPressOut = () => {
    scale.value = withSpring(1, springCfg);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { onPressIn, onPressOut, animatedStyle };
}
