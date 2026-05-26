/**
 * Backfill yesterday's progress. Lists yesterday's routine blocks and lets the
 * user tap any incomplete one to mark it done after the fact — for when they
 * forgot to check things off in the moment.
 */
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { format, subDays } from 'date-fns';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Body, Caption, Heading } from '@/components/ui/Typography';
import { getRoutineBlocksByDate, updateRoutineBlockStatus } from '@/db/queries/routine';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called when a block's status changes so the parent can refresh gamification. */
  onLogged: (module: string) => void;
}

type Block = ReturnType<typeof getRoutineBlocksByDate>[number];

export function YesterdayLogSheet({ visible, onClose, onLogged }: Props) {
  const c = useColors();
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const [blocks, setBlocks] = useState<Block[]>([]);

  const reload = useCallback(() => {
    setBlocks(getRoutineBlocksByDate(yesterday));
  }, [yesterday]);

  useEffect(() => {
    if (visible) reload();
  }, [visible, reload]);

  const toggle = (b: Block) => {
    const next = b.status === 'completed' ? 'upcoming' : 'completed';
    updateRoutineBlockStatus(b.id, next);
    if (next === 'completed') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onLogged(b.module);
    }
    reload();
  };

  const doneCount = blocks.filter((b) => b.status === 'completed').length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: c.overlay }]} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View>
            <Heading style={{ color: c.textPrimary }}>Log yesterday</Heading>
            <Caption style={{ color: c.textMuted }}>
              {blocks.length === 0 ? 'No blocks were planned yesterday.' : `${doneCount}/${blocks.length} marked done`}
            </Caption>
          </View>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={c.textPrimary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ gap: spacing.xs, paddingBottom: spacing.lg }}>
          {blocks.map((b) => {
            const done = b.status === 'completed';
            return (
              <Pressable
                key={b.id}
                onPress={() => toggle(b)}
                style={[styles.row, { backgroundColor: c.card, borderColor: done ? c.success + '55' : c.border }]}
              >
                <Ionicons
                  name={done ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={done ? c.success : c.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Body style={{ color: c.textPrimary, textDecorationLine: done ? 'line-through' : 'none' }} numberOfLines={1}>
                    {b.title}
                  </Body>
                  <Caption style={{ color: c.textMuted }}>{b.startTime}–{b.endTime}</Caption>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl,
    maxHeight: '75%',
  },
  handle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, borderRadius: 14, borderWidth: 1,
  },
});
