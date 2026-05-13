import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import { Text as AuroraText } from './Text';

// iOS-style snap-scroll wheel picker. Renders a fixed-height column with
// VISIBLE rows; the centered row is the selected value. Aurora visuals:
// rounded glass surface, soft fade above/below the selection, two hairline
// dividers framing the center row.

const ITEM_HEIGHT = 40;
const VISIBLE_ROWS = 5; // odd number; the middle row is the selection
const CENTER_INDEX = Math.floor(VISIBLE_ROWS / 2);
const VIEWPORT_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;

interface WheelTimePickerProps {
  label: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  // Optional renderer — by default the raw option string is shown.
  formatValue?: (v: string) => string;
}

export function WheelTimePicker({ label, options, selected, onSelect, formatValue }: WheelTimePickerProps) {
  const c = useColors();
  const scrollRef = useRef<ScrollView | null>(null);
  const [activeIdx, setActiveIdx] = useState(() => {
    const idx = options.indexOf(selected);
    return idx >= 0 ? idx : 0;
  });
  const lastReportedRef = useRef<string>(selected);

  // Sync scroll position when `selected` changes externally.
  useEffect(() => {
    const idx = options.indexOf(selected);
    if (idx >= 0 && idx !== activeIdx) {
      setActiveIdx(idx);
      scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // On mount, scroll to current selection without animation.
  useEffect(() => {
    const idx = options.indexOf(selected);
    if (idx >= 0) {
      scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSnap = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(options.length - 1, idx));
    if (options[clamped] !== lastReportedRef.current) {
      lastReportedRef.current = options[clamped];
      onSelect(options[clamped]);
      if (Platform.OS !== 'web') {
        Haptics.selectionAsync().catch(() => undefined);
      }
    }
    setActiveIdx(clamped);
  }, [options, onSelect]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / ITEM_HEIGHT);
    if (idx !== activeIdx) setActiveIdx(Math.max(0, Math.min(options.length - 1, idx)));
  }, [activeIdx, options.length]);

  const handleMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    handleSnap(idx);
  }, [handleSnap]);

  const contentPad = useMemo(() => CENTER_INDEX * ITEM_HEIGHT, []);

  return (
    <View style={styles.wrap}>
      <AuroraText variant="micro" muted style={styles.label}>{label.toUpperCase()}</AuroraText>
      <View
        style={[
          styles.viewport,
          {
            backgroundColor: c.surfaceAlt,
            borderColor: c.border,
          },
        ]}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onScroll={handleScroll}
          onMomentumScrollEnd={handleMomentumEnd}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingVertical: contentPad }}
        >
          {options.map((opt, i) => {
            const distance = Math.abs(i - activeIdx);
            const isActive = distance === 0;
            return (
              <View key={opt} style={styles.row}>
                <Text
                  style={{
                    fontFamily: isActive ? fonts.display : fonts.heading,
                    fontSize: isActive ? 22 : 18,
                    color: isActive
                      ? c.textPrimary
                      : distance === 1
                        ? c.textSecondary
                        : c.textMuted,
                    fontVariant: ['tabular-nums'],
                    opacity: isActive ? 1 : Math.max(0.25, 1 - distance * 0.3),
                  }}
                >
                  {formatValue ? formatValue(opt) : opt}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Center selection hairlines */}
        <View pointerEvents="none" style={[styles.centerBand, {
          top: CENTER_INDEX * ITEM_HEIGHT,
          height: ITEM_HEIGHT,
          borderColor: c.primary + '55',
          backgroundColor: c.primary + '0F',
        }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 130,
    gap: spacing.xs,
  },
  label: {
    paddingLeft: 2,
  },
  viewport: {
    height: VIEWPORT_HEIGHT,
    borderRadius: radii.control,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  row: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
});
