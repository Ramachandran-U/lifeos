import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { TIMING } from '@/theme/motion';
import { fonts } from '@/theme/typography';
import { Body, Caption } from '@/components/ui/Typography';

export interface DraggableBlock {
  startTime: string;
  endTime: string;
  title: string;
  module: string;
  energyRequired?: string;
}

interface Props {
  blocks: DraggableBlock[];
  /** Resolve a module key to its theme colour. */
  moduleColor: (module: string) => string;
  /** Commit a move: the activity at `from` goes to slot `to` (times stay fixed). */
  onReorder: (from: number, to: number) => void;
  /** Lets the parent disable its ScrollView while a drag is in progress. */
  onDragActiveChange?: (active: boolean) => void;
}

const ROW_HEIGHT = 76;
const CARD_GAP = 8;
const TIME_W = 58;

function clampW(v: number, lo: number, hi: number): number {
  'worklet';
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Drag-to-reorder routine list with FIXED time slots: the time windows are a
 * static left rail; only the activity cards move. On drop we emit a single
 * onReorder(from, to) — the caller re-pins times by position (see
 * reorderBlocksFixedSlots), so the schedule never shifts, only *what* happens
 * when. Hold (long-press) to pick a card up, so vertical scrolling still works.
 */
export function DraggableRoutineList({ blocks, moduleColor, onReorder, onDragActiveChange }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const count = blocks.length;

  // -1 when idle, else the index being dragged. dragY = finger delta from origin.
  const activeIndex = useSharedValue(-1);
  const dragY = useSharedValue(0);

  return (
    <View style={[styles.container, { height: count * ROW_HEIGHT }]}>
      {/* Static time rail — one fixed window per slot position. */}
      {blocks.map((b, i) => (
        <View key={`t-${i}`} style={[styles.timeSlot, { top: i * ROW_HEIGHT, height: ROW_HEIGHT }]} pointerEvents="none">
          <Caption style={styles.timeText}>{b.startTime}</Caption>
          <Caption style={styles.timeMuted}>{b.endTime}</Caption>
        </View>
      ))}

      {/* Draggable activity cards. */}
      {blocks.map((block, index) => (
        <DragRow
          key={`c-${index}`}
          index={index}
          count={count}
          block={block}
          color={moduleColor(block.module)}
          activeIndex={activeIndex}
          dragY={dragY}
          onReorder={onReorder}
          onDragActiveChange={onDragActiveChange}
          c={c}
          styles={styles}
        />
      ))}
    </View>
  );
}

interface RowProps {
  index: number;
  count: number;
  block: DraggableBlock;
  color: string;
  activeIndex: SharedValue<number>;
  dragY: SharedValue<number>;
  onReorder: (from: number, to: number) => void;
  onDragActiveChange?: (active: boolean) => void;
  c: AppColors;
  styles: ReturnType<typeof makeStyles>;
}

function DragRow({ index, count, block, color, activeIndex, dragY, onReorder, onDragActiveChange, c, styles }: RowProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const from = activeIndex.value;
    if (from === index) {
      // The card under the finger: follow it, lift it.
      return {
        transform: [{ translateY: index * ROW_HEIGHT + dragY.value }, { scale: 1.04 }],
        zIndex: 20,
        shadowOpacity: 0.35,
        opacity: 1,
      };
    }
    // Other cards slide to make room for the dragged card's target slot.
    let slot = index;
    if (from !== -1) {
      const to = clampW(from + Math.round(dragY.value / ROW_HEIGHT), 0, count - 1);
      if (from < to && index > from && index <= to) slot = index - 1;
      else if (from > to && index < from && index >= to) slot = index + 1;
    }
    return {
      transform: [{ translateY: withTiming(slot * ROW_HEIGHT, { duration: TIMING.fast }) }, { scale: 1 }],
      zIndex: 1,
      shadowOpacity: 0,
      opacity: 1,
    };
  });

  const pan = Gesture.Pan()
    .activateAfterLongPress(160)
    .onStart(() => {
      activeIndex.value = index;
      if (onDragActiveChange) runOnJS(onDragActiveChange)(true);
    })
    .onUpdate((e) => {
      dragY.value = e.translationY;
    })
    .onEnd(() => {
      const to = clampW(index + Math.round(dragY.value / ROW_HEIGHT), 0, count - 1);
      if (to !== index) runOnJS(onReorder)(index, to);
      dragY.value = 0;
      activeIndex.value = -1;
      if (onDragActiveChange) runOnJS(onDragActiveChange)(false);
    })
    .onFinalize(() => {
      if (activeIndex.value === index) {
        dragY.value = 0;
        activeIndex.value = -1;
        if (onDragActiveChange) runOnJS(onDragActiveChange)(false);
      }
    });

  return (
    <Animated.View style={[styles.card, { height: ROW_HEIGHT - CARD_GAP }, animatedStyle]}>
      <GestureDetector gesture={pan}>
        <View style={[styles.cardInner, { borderLeftColor: color, backgroundColor: c.card }]}>
          <Ionicons name="reorder-three" size={20} color={c.textMuted} style={styles.handle} />
          <View style={styles.cardContent}>
            <Body style={styles.cardTitle} numberOfLines={1}>{block.title}</Body>
            <Caption style={{ color }}>{block.module}</Caption>
          </View>
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  container: { position: 'relative', width: '100%' },
  timeSlot: {
    position: 'absolute',
    left: 0,
    width: TIME_W,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 2,
  },
  timeText: { color: c.textSecondary, fontFamily: fonts.bodyMedium },
  timeMuted: { color: c.textMuted },
  card: {
    position: 'absolute',
    left: TIME_W,
    right: 0,
    top: 0,
    // Web shadow; native uses shadowOpacity driven by the animated style.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  cardInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    borderLeftWidth: 4,
  },
  handle: { opacity: 0.7 },
  cardContent: { flex: 1, gap: spacing.xs },
  cardTitle: { fontFamily: fonts.bodyMedium, color: c.textPrimary },
});
