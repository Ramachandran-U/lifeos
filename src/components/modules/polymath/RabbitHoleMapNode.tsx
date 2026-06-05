import { Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
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
 * thicker gold ring. */
export function RabbitHoleMapNode({ title, kind, arrivedVia, x, y, width, height, onPress, onLayout, accessibilityLabel }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const ghost = kind === 'ghost';
  const cursor = kind === 'cursor';
  const onPath = cursor || kind === 'path';

  const borderColor = onPath ? c.polymath : c.border;
  const backgroundColor = ghost ? 'transparent' : onPath ? c.polymath + '14' : c.card;

  return (
    <Animated.View entering={FadeIn.duration(240)} style={[styles.wrap, { left: x, top: y, width, height }]}>
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
});
