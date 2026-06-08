import { useEffect } from 'react';
import { Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  FadeIn,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import { Caption } from '@/components/ui/Typography';
import type { RabbitHoleDirection } from '@/explore/rabbitHoleTree';

export type MapNodeKind = 'cursor' | 'path' | 'visited' | 'ghost';

interface Props {
  title: string;
  kind: MapNodeKind;
  arrivedVia?: RabbitHoleDirection | null;
  x: number;
  y: number;
  width: number;
  height: number;
  onPress: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
  accessibilityLabel?: string;
}

/** One tile on the map. Encodes its state: gold = active path · neutral solid =
 * visited-off-path · dashed faint = an un-taken ghost fork. The cursor gets a
 * pulsing gold ring. */
export function RabbitHoleMapNode({ title, kind, arrivedVia, x, y, width, height, onPress, onLayout, accessibilityLabel }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const ghost = kind === 'ghost';
  const cursor = kind === 'cursor';
  const onPath = cursor || kind === 'path';

  const borderColor = onPath ? c.polymath : c.border;
  const backgroundColor = ghost ? 'transparent' : onPath ? c.polymath + '14' : c.card;

  // Ripple ring: expands and fades out repeatedly while this tile is the cursor.
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);

  useEffect(() => {
    if (cursor) {
      ringScale.value = withRepeat(
        withSequence(withTiming(1, { duration: 0 }), withTiming(1.4, { duration: 1100 })),
        -1,
        false,
      );
      ringOpacity.value = withRepeat(
        withSequence(withTiming(0.55, { duration: 0 }), withTiming(0, { duration: 1100 })),
        -1,
        false,
      );
    } else {
      cancelAnimation(ringScale);
      cancelAnimation(ringOpacity);
      ringScale.value = withTiming(1, { duration: 150 });
      ringOpacity.value = withTiming(0, { duration: 150 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  // New realized nodes pop in; ghost and path nodes (already in tree) just fade.
  const entering = ghost || kind === 'path' || kind === 'visited'
    ? FadeIn.duration(200)
    : ZoomIn.duration(220).springify().damping(14);

  return (
    <Animated.View entering={entering} style={[styles.wrap, { left: x, top: y, width, height }]}>
      {cursor && (
        <Animated.View
          style={[StyleSheet.absoluteFillObject, styles.cursorRing, { borderColor: c.polymath }, ringStyle]}
          pointerEvents="none"
        />
      )}
      <Pressable
        onPress={onPress}
        onLayout={onLayout}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        style={[
          styles.tile,
          {
            borderColor,
            backgroundColor,
            borderWidth: cursor ? 2 : 1,
            borderStyle: ghost ? 'dashed' : 'solid',
            opacity: ghost ? 0.5 : 1,
          },
        ]}
      >
        {ghost ? (
          <Caption style={{ color: c.textMuted, fontFamily: fonts.heading }}>⊕</Caption>
        ) : (
          <>
            <Caption style={{ color: c.polymath, fontSize: 10, fontFamily: fonts.heading }}>
              {arrivedVia == null ? '✦' : arrivedVia === 'deeper' ? '↓' : '↻'}
            </Caption>
            <Caption style={{ color: c.textPrimary, fontSize: 11 }} numberOfLines={2}>
              {title}
            </Caption>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (_c: AppColors) => StyleSheet.create({
  wrap: { position: 'absolute' },
  tile: {
    flex: 1,
    borderRadius: radii.tile,
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  cursorRing: {
    borderRadius: radii.tile,
    borderWidth: 2,
  },
});
