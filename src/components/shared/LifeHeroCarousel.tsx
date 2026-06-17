/**
 * LifeHeroCarousel — Today's swipeable hero deck.
 *
 * The "next immediate action" card is the anchor (panel 1); sliding reveals
 * the day's other live signals — Streaks (panel 2) and Today's Quest (panel 3)
 * — folded in from what used to be three separate stacked sections. One card
 * shows at a time; the next peeks at the right edge so the swipe is
 * discoverable.
 *
 * Dynamic feel (the brief): as you drag, the centred card sits at full
 * scale/opacity while neighbours recede (scale 0.92, dim, sink a few px) — a
 * transform-only parallax that stays on the compositor (60fps, web-safe). A
 * pill page-indicator expands under the active panel, and each settle fires a
 * selection haptic (native only). All of it collapses to a static deck under
 * reduce-motion / motion-intensity off.
 *
 * Content-agnostic by design: the screen passes ready-rendered panels, so this
 * file owns paging + motion only and never reaches into stores. Panels declare
 * their own height via the shared `height` floor so every slide lines up.
 */
import { useCallback, useState, type ReactNode } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/theme/colors';
import { useMotionScale } from '@/theme/motion';
import { spacing } from '@/theme/spacing';

export interface HeroPanelSpec {
  key: string;
  /** Spoken label for the slide (the panel content carries its own a11y tree). */
  accessibilityLabel: string;
  render: () => ReactNode;
}

interface LifeHeroCarouselProps {
  panels: HeroPanelSpec[];
  /** Shared minimum height so all slides line up (px). */
  height: number;
}

// Gutter between cards, and how much of the next card peeks past the active
// one's right edge. The active card is `width - PEEK` wide; the peek is what
// signals "swipe me".
const GAP = 12;
const PEEK = 44;

/**
 * Shared min-height (px) for every hero slide, so the deck never jumps as you
 * swipe. Sized to the tallest natural panel (two compact quests). Panels fill
 * it via `flex: 1`; taller content grows the deck rather than clipping.
 */
export const HERO_PANEL_HEIGHT = 232;

export function LifeHeroCarousel({ panels, height }: LifeHeroCarouselProps) {
  const c = useColors();
  const animate = useMotionScale() > 0;
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);
  const scrollX = useSharedValue(0);

  const count = panels.length;
  const cardW = width > 0 ? Math.max(0, width - PEEK) : 0;
  const stride = cardW + GAP;

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const onSettle = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (stride <= 0) return;
      const idx = Math.max(0, Math.min(count - 1, Math.round(e.nativeEvent.contentOffset.x / stride)));
      setActive((prev) => {
        if (prev !== idx && Platform.OS !== 'web') {
          Haptics.selectionAsync().catch(() => undefined);
        }
        return idx;
      });
    },
    [stride, count],
  );

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  // One panel (e.g. gamification off, or a cold-start day): no deck chrome.
  if (count <= 1) {
    return (
      <View onLayout={onLayout} style={{ minHeight: height }}>
        {panels[0]?.render()}
      </View>
    );
  }

  // `cardW` is 0 until the first layout measures `width`; the cards size up on
  // the next frame. Rendering them at width 0 for that frame is harmless and
  // keeps the panels mounted (no blank flash, and testable without a layout pass).
  return (
    <View onLayout={onLayout}>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={stride}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onSettle}
        onScrollEndDrag={onSettle}
        contentContainerStyle={{ paddingRight: PEEK }}
      >
        {panels.map((p, i) => (
          <PanelCell
            key={p.key}
            index={i}
            width={cardW}
            height={height}
            stride={stride}
            marginRight={i < count - 1 ? GAP : 0}
            scrollX={scrollX}
            animate={animate}
            accessibilityLabel={p.accessibilityLabel}
          >
            {p.render()}
          </PanelCell>
        ))}
      </Animated.ScrollView>

      <View style={styles.dots}>
        {panels.map((p, i) => (
          <Dot
            key={p.key}
            index={i}
            stride={stride}
            scrollX={scrollX}
            color={c.textPrimary}
            isActive={active === i}
            animate={animate}
          />
        ))}
      </View>
    </View>
  );
}

interface PanelCellProps {
  index: number;
  width: number;
  height: number;
  stride: number;
  marginRight: number;
  scrollX: SharedValue<number>;
  animate: boolean;
  accessibilityLabel: string;
  children: ReactNode;
}

function PanelCell({ index, width, height, stride, marginRight, scrollX, animate, accessibilityLabel, children }: PanelCellProps) {
  const animStyle = useAnimatedStyle(() => {
    if (!animate || stride <= 0) return {};
    const input = [(index - 1) * stride, index * stride, (index + 1) * stride];
    return {
      opacity: interpolate(scrollX.value, input, [0.55, 1, 0.55], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(scrollX.value, input, [0.92, 1, 0.92], Extrapolation.CLAMP) },
        { translateY: interpolate(scrollX.value, input, [10, 0, 10], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <View style={{ width, marginRight }} accessible accessibilityLabel={accessibilityLabel}>
      <Animated.View style={[styles.cell, { minHeight: height }, animStyle]}>{children}</Animated.View>
    </View>
  );
}

interface DotProps {
  index: number;
  stride: number;
  scrollX: SharedValue<number>;
  color: string;
  isActive: boolean;
  animate: boolean;
}

function Dot({ index, stride, scrollX, color, isActive, animate }: DotProps) {
  const dotStyle = useAnimatedStyle(() => {
    if (!animate || stride <= 0) {
      return { width: isActive ? 20 : 6, opacity: isActive ? 1 : 0.3 };
    }
    const input = [(index - 1) * stride, index * stride, (index + 1) * stride];
    return {
      width: interpolate(scrollX.value, input, [6, 20, 6], Extrapolation.CLAMP),
      opacity: interpolate(scrollX.value, input, [0.3, 1, 0.3], Extrapolation.CLAMP),
    };
  });

  return <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle]} />;
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
  },
  dots: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginTop: spacing.md,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
