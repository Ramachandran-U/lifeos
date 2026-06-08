import { useEffect, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { radii } from '@/theme/radii';
import { Caption } from '@/components/ui/Typography';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { useRabbitHoleStore } from '@/store/useRabbitHoleStore';
import { loadOrCreateThread, loadThreadById, renameActiveThread, type RabbitHoleSeed } from '@/explore/rabbitHoleActions';
import {
  asLookup,
  depthOf,
  maxDeeperDepth,
  realizedBranchCount,
  pathToRoot,
  RABBIT_HOLE_MAX_DEPTH,
} from '@/explore/rabbitHoleTree';
import { RabbitHoleMapView } from './RabbitHoleMapView';
import { RabbitHoleNodeCard } from './RabbitHoleNodeCard';
import { RabbitHoleDepthBadge } from './RabbitHoleDepthBadge';
import { RabbitHoleBreadcrumb } from './RabbitHoleBreadcrumb';
import { RabbitHoleExitSummary } from './RabbitHoleExitSummary';

const WIDE_BREAKPOINT = 900;

interface Props {
  seed: RabbitHoleSeed | null;
  treeId?: string;
  onExit: () => void;
}

/** The decision-tree-map rabbit hole. Phone: a map with a Focus sheet over a
 * dimmed map. Web (>= 900pt): a map pane + a persistent Focus pane. */
export function RabbitHoleScreen({ seed, treeId, onExit }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;

  const nodeMap = useRabbitHoleStore((s) => s.nodeMap);
  const rootId = useRabbitHoleStore((s) => s.rootId);
  const cursorId = useRabbitHoleStore((s) => s.cursorId);
  const anchor = useRabbitHoleStore((s) => s.anchor);
  const scoring = useRabbitHoleStore((s) => s.scoring);
  const xpAwarded = useRabbitHoleStore((s) => s.xpAwarded);
  const sheetOpen = useRabbitHoleStore((s) => s.sheetOpen);
  const setSheetOpen = useRabbitHoleStore((s) => s.setSheetOpen);
  const jumpTo = useRabbitHoleStore((s) => s.jumpTo);
  const climb = useRabbitHoleStore((s) => s.climb);

  const [showExit, setShowExit] = useState(false);

  // Open (or resume) the tree. treeId = resume a stored map; seed = new/existing spark thread.
  useEffect(() => {
    if (treeId) { loadThreadById(treeId); return; }
    if (seed) loadOrCreateThread(seed);
    // Re-run only when the tree identity changes, not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeId ?? seed?.sparkId]);

  const cursor = cursorId ? nodeMap[cursorId] ?? null : null;
  const lookup = asLookup(nodeMap);
  const depth = cursorId ? depthOf(cursorId, lookup) : 0;
  const trail = cursorId
    ? pathToRoot(cursorId, lookup).map((n) => ({ id: n.id, title: n.title }))
    : [];

  const focus = cursor ? (
    <ScrollView contentContainerStyle={styles.focusScroll}>
      <RabbitHoleBreadcrumb trail={trail} onJump={(id) => jumpTo(id)} />
      <RabbitHoleNodeCard node={cursor} onClimb={() => climb()} onMap={() => setSheetOpen(false)} />
    </ScrollView>
  ) : null;

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={onExit} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={24} color={c.textPrimary} />
          </Pressable>
          <RabbitHoleDepthBadge depth={depth} max={RABBIT_HOLE_MAX_DEPTH} />
          <Pressable onPress={() => setShowExit(true)} hitSlop={8} accessibilityRole="button">
            <Caption style={{ color: c.textMuted, fontFamily: fonts.heading }}>Done</Caption>
          </Pressable>
        </View>

        {anchor ? (
          <Caption style={[styles.anchor, { color: c.textMuted }]} numberOfLines={1}>
            From: {anchor.title}
          </Caption>
        ) : null}

        <View style={[styles.body, wide && styles.bodyRow]}>
          <View style={styles.mapPane}>
            <RabbitHoleMapView onFocusNode={() => setSheetOpen(true)} />
          </View>
          {wide ? <View style={styles.sidePane}>{focus}</View> : null}
        </View>

        {!wide && sheetOpen && cursor ? (
          <>
            <Pressable style={styles.backdrop} onPress={() => setSheetOpen(false)} accessibilityLabel="Close" />
            <Animated.View
              entering={SlideInDown.springify().damping(18).stiffness(180)}
              exiting={SlideOutDown.duration(220)}
              style={styles.sheet}
            >
              <Pressable onPress={() => setSheetOpen(false)} style={styles.grab} accessibilityLabel="Close sheet">
                <View style={styles.grabBar} />
              </Pressable>
              {focus}
            </Animated.View>
          </>
        ) : null}

        {showExit ? (
          <View style={styles.exitOverlay}>
            <RabbitHoleExitSummary
              depth={rootId ? maxDeeperDepth(rootId, lookup) : 0}
              branches={rootId ? realizedBranchCount(rootId, lookup) : 0}
              synapses={scoring?.scoredSynapsePairs.length ?? 0}
              xp={xpAwarded}
              onDone={(name) => {
                if (name) renameActiveThread(name);
                onExit();
              }}
            />
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  anchor: { fontSize: fontSizes.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  body: { flex: 1, marginTop: spacing.sm },
  bodyRow: { flexDirection: 'row' },
  mapPane: { flex: 1 },
  sidePane: { width: 380, borderLeftWidth: 1, borderLeftColor: c.border },
  focusScroll: { padding: spacing.lg, gap: spacing.md },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: c.overlay },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '64%',
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    borderColor: c.border,
  },
  grab: { alignItems: 'center', paddingVertical: spacing.sm },
  grabBar: { width: 40, height: 4, borderRadius: radii.hairline, backgroundColor: c.textMuted },
  exitOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
});
