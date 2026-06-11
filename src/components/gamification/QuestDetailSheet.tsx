import { useCallback, useEffect, useState } from 'react';
import { Modal, View, StyleSheet, Pressable, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { TIMING, useStaggerDelay } from '@/theme/motion';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Body, Caption, Heading, Label } from '@/components/ui/Typography';
import { XpBar } from './XpBar';
import { XpChip } from './XpChip';
import { MODULE_META, type Quest } from '@/constants/gamification';
import { getRoutineBlocksByDate, updateRoutineBlockStatus } from '@/db/queries/routine';
import { useGameStore } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';

// What the user actually does to move each quest forward, plus where to do it
// when there's no checkable routine block today. Keyed by v2 metricKey, with
// the three legacy quest ids kept for the flag-off path.
const QUEST_HOWTO: Record<string, { how: string; route?: string }> = {
  // legacy (DEFAULT_QUESTS ids)
  q_food: { how: 'Log each meal from the Health tab. Every logged meal ticks this quest.', route: '/(tabs)/health' },
  q_routine: { how: 'Complete the routine blocks scheduled for today. Each one counts.', route: '/(tabs)' },
  q_learn: { how: 'Finish a learning resource in Explore to complete this week’s quest.', route: '/(tabs)/explore' },
  // quests_v2 metric keys
  blocks_completed: { how: 'Complete the routine blocks scheduled for today. Each one counts.', route: '/(tabs)' },
  meals_logged: { how: 'Log each meal from the Health tab. Every logged meal ticks this quest.', route: '/(tabs)/health' },
  weight_logged: { how: 'Log your weight from the Health tab vitals card.', route: '/(tabs)/health' },
  water_logged: { how: 'Track each glass on the Health tab water card.', route: '/(tabs)/health' },
  learning_resource: { how: 'Finish a learning resource in Explore.', route: '/(tabs)/explore' },
  spark_engaged: { how: 'Open Explore and chase today’s spark.', route: '/(tabs)/explore' },
  journal: { how: 'Close the day with an evening reflection.', route: '/evening-reflect' },
  social_touch: { how: 'Log a call, message, or meetup with someone in Social.', route: '/(tabs)/social' },
  goal_task: { how: 'Complete a task on any goal from the Goals tab.', route: '/(tabs)/goals' },
};

interface Props {
  quest: Quest | null;
  visible: boolean;
  onClose: () => void;
  /** Called after a block is completed so the parent can refresh quest state. */
  onChanged?: () => void;
  /** quests_v2: claim the earned XP (rendered when status === 'completed'). */
  onClaim?: () => void;
  /** quests_v2: swap this quest for another (one free per day, progress 0 only). */
  onReroll?: () => void;
}

export function QuestDetailSheet({ quest, visible, onClose, onChanged, onClaim, onReroll }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const stagger = useStaggerDelay();
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);
  const completeBlock = useGameStore((s) => s.completeBlock);

  const today = format(new Date(), 'yyyy-MM-dd');
  type BlockRow = { id: string; title: string; startTime: string; endTime: string; status: string; module: string };
  const [blocks, setBlocks] = useState<BlockRow[]>([]);

  const refresh = useCallback(() => {
    if (!quest) return;
    const all = getRoutineBlocksByDate(today) as BlockRow[];
    // Block-based quests track ALL blocks completed today (cross-domain).
    const crossDomain = quest.id === 'q_routine' || quest.metricKey === 'blocks_completed';
    setBlocks(crossDomain ? all : all.filter((b) => b.module === quest.module));
  }, [quest, today]);

  // Refresh whenever the sheet opens (it's a modal, not a navigated screen, so
  // focus effects don't fire on open).
  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  if (!quest) return null;
  const meta = MODULE_META[quest.module];
  const color = c[meta.colorKey];
  const pct = quest.total > 0 ? quest.progress / quest.total : 0;
  const done = pct >= 1;
  // v2 quests carry a metricKey; legacy quests key by id.
  const howto = QUEST_HOWTO[quest.metricKey ?? quest.id];
  const claimable = !!onClaim && quest.status === 'completed';
  const claimed = quest.status === 'claimed';
  const rerollable = !!onReroll && quest.status === 'active' && quest.progress === 0;
  const pending = blocks.filter((b) => b.status !== 'completed');

  const handleComplete = (blockId: string) => {
    if (!userId) return;
    updateRoutineBlockStatus(blockId, 'completed');
    const moduleBlocks = blocks.filter((b) => b.module === quest.module);
    const completed = moduleBlocks.filter((b) => b.id === blockId || b.status === 'completed').length;
    // completeBlock credits XP itself — no extra addXP (QA double-credit fix).
    completeBlock(userId, quest.module, completed, moduleBlocks.length || 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
    onChanged?.();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeIn.delay(120 + stagger(0, 50)).duration(TIMING.normal)}>
              <View style={styles.header}>
                <View style={[styles.iconBox, { backgroundColor: c.surfaceAlt }]}>
                  <Body style={{ fontSize: 20 }}>{meta.emoji}</Body>
                </View>
                <View style={{ flex: 1 }}>
                  <Label color={color}>{quest.type === 'daily' ? 'DAILY QUEST' : 'WEEKLY QUEST'}</Label>
                  <Heading style={[styles.title, { color: c.textPrimary }]}>{quest.title}</Heading>
                </View>
                <XpChip amount={quest.xp} />
              </View>
            </Animated.View>

            <Animated.View entering={FadeIn.delay(120 + stagger(1, 50)).duration(TIMING.normal)}>
              <View style={styles.progressRow}>
                <View style={{ flex: 1 }}>
                  <XpBar pct={pct} color={color} height={6} />
                </View>
                <Caption style={{ color: c.textMuted }}>{quest.progress}/{quest.total}</Caption>
              </View>
            </Animated.View>

            {howto && (
              <Animated.View entering={FadeIn.delay(120 + stagger(2, 50)).duration(TIMING.normal)}>
                <Body style={[styles.how, { color: c.textSecondary }]}>{howto.how}</Body>
              </Animated.View>
            )}

            <Animated.View entering={FadeIn.delay(120 + stagger(3, 50)).duration(TIMING.normal)}>
              {claimable ? (
                <Pressable
                  onPress={onClaim}
                  accessibilityRole="button"
                  accessibilityLabel={`Claim ${quest.xp} XP`}
                  style={[styles.goBtn, { backgroundColor: color }]}
                >
                  <Body style={{ color: c.inkOnColor, fontFamily: fonts.heading }}>Claim +{quest.xp} XP</Body>
                  <Ionicons name="sparkles" size={16} color={c.inkOnColor} />
                </Pressable>
              ) : done || claimed ? (
                // Done state is data — solid hue border, neutral fill.
                <View style={[styles.doneBanner, { backgroundColor: c.surfaceAlt, borderColor: color }]}>
                  <Ionicons name="checkmark-circle" size={18} color={color} />
                  <Body style={{ color: c.textPrimary }}>
                    {claimed ? 'Claimed — nice work!' : 'Quest complete — nice work!'}
                  </Body>
                </View>
              ) : pending.length > 0 ? (
                <View style={styles.taskList}>
                  <Label style={{ color: c.textMuted }}>TODAY'S TASKS</Label>
                  {pending.map((b) => (
                    <View key={b.id} style={[styles.taskRow, { borderColor: c.border }]}>
                      <View style={{ flex: 1 }}>
                        <Body style={{ color: c.textPrimary }} numberOfLines={2}>{b.title}</Body>
                        <Caption style={{ color: c.textMuted }}>{b.startTime}–{b.endTime}</Caption>
                      </View>
                      <Pressable
                        onPress={() => handleComplete(b.id)}
                        style={[styles.doBtn, { backgroundColor: color }]}
                      >
                        <Ionicons name="checkmark" size={16} color="#fff" />
                        <Caption style={{ color: '#fff', fontFamily: fonts.heading }}>Done</Caption>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    onClose();
                    if (howto?.route) router.push(howto.route);
                  }}
                  style={[styles.goBtn, { backgroundColor: color }]}
                >
                  <Body style={{ color: '#fff', fontFamily: fonts.heading }}>
                    Go to {howto?.route === '/(tabs)' ? 'Today' : meta.label}
                  </Body>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </Pressable>
              )}
            </Animated.View>

            {rerollable && (
              <Pressable
                onPress={onReroll}
                accessibilityRole="button"
                accessibilityLabel="Swap this quest for another"
                style={[styles.rerollBtn, { borderColor: c.border }]}
              >
                <Ionicons name="shuffle" size={14} color={c.textSecondary} />
                <Caption style={{ color: c.textSecondary }}>Not feeling it? Swap this quest (1/day)</Caption>
              </Pressable>
            )}

            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Body style={{ color: c.textSecondary }}>Close</Body>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginBottom: spacing.md },
  scroll: { gap: spacing.md, paddingBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSizes.lg, marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  how: { lineHeight: 21 },
  doneBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 14, borderWidth: 1 },
  taskList: { gap: spacing.sm },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderRadius: 14 },
  doBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: 10 },
  goBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderRadius: 14 },
  rerollBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: 14, borderWidth: 1 },
  closeBtn: { alignItems: 'center', paddingVertical: spacing.sm },
});
