import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { format, parseISO, subDays } from 'date-fns';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Body, Caption, Heading, Label } from '@/components/ui/Typography';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Card } from '@/components/ui/Card';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { InkCanvas } from '@/components/shared/InkCanvas';
import { useActivityFeed } from '@/hooks/useActivityFeed';
import { prettifyKey, snapshotTitle, type ActivityItem } from '@/sync/activityFeed';
import type { HistoryEntry } from '@/sync/history';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  goals: 'flag-outline',
  routine_blocks: 'calendar-outline',
  daily_reflections: 'moon-outline',
  sparks: 'sparkles-outline',
  expeditions: 'compass-outline',
  expedition_progress: 'compass-outline',
  user_profiles: 'person-outline',
  gamification: 'trophy-outline',
  interests: 'color-palette-outline',
  users: 'person-circle-outline',
};
const iconFor = (entity: string): keyof typeof Ionicons.glyphMap =>
  ICONS[entity] ?? 'ellipse-outline';

function opColor(op: ActivityItem['op'], c: AppColors): string {
  if (op === 'insert') return c.success;
  if (op === 'delete') return c.warning;
  return c.primary;
}

function dayLabel(day: string): string {
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const yesterdayKey = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  if (day === todayKey) return 'Today';
  if (day === yesterdayKey) return 'Yesterday';
  return format(parseISO(day), 'EEE, MMM d');
}

interface Selected {
  entity: string;
  entityId: string;
  label: string;
  title: string | null;
  restorable: boolean;
}

export default function ActivityScreen() {
  const c = useColors();
  const router = useRouter();
  const { status, days, error, reload, loadHistory, restore } = useActivityFeed();

  const [selected, setSelected] = useState<Selected | null>(null);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const openTimeline = useCallback(
    (item: ActivityItem) => {
      Haptics.selectionAsync();
      setSelected({
        entity: item.entity,
        entityId: item.entityId,
        label: item.entityLabel,
        title: item.title,
        restorable: item.restorable,
      });
      setHistory(null);
      setHistoryLoading(true);
      loadHistory(item.entity, item.entityId)
        .then(setHistory)
        .catch(() => setHistory([]))
        .finally(() => setHistoryLoading(false));
    },
    [loadHistory],
  );

  const closeTimeline = useCallback(() => {
    setSelected(null);
    setHistory(null);
  }, []);

  const doRestore = useCallback(
    async (entry: HistoryEntry) => {
      if (!selected) return;
      setRestoring(true);
      try {
        const ok = await restore(selected.entity, selected.entityId, { lamport: entry.lamport });
        closeTimeline();
        if (!ok) {
          Alert.alert('Nothing to restore', 'That version had no saved state to bring back.');
        }
      } catch (err) {
        Alert.alert('Restore failed', err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setRestoring(false);
      }
    },
    [selected, restore, closeTimeline],
  );

  const confirmRestore = useCallback(
    (entry: HistoryEntry) => {
      if (!selected) return;
      const when = format(parseISO(entry.ts), 'MMM d, HH:mm');
      const name = `${selected.label}${selected.title ? `: ${selected.title}` : ''}`;
      Alert.alert(
        'Restore this version?',
        `${name} will be set back to how it was on ${when}. This is saved as a new change, so you can undo it the same way.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Restore', style: 'destructive', onPress: () => void doRestore(entry) },
        ],
      );
    },
    [selected, doRestore],
  );

  const inTimeline = selected !== null;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <InkCanvas />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={styles.topRow}>
          <Pressable onPress={() => (inTimeline ? closeTimeline() : router.back())} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
          </Pressable>
          {!inTimeline ? (
            <Pressable onPress={() => void reload()} hitSlop={12} disabled={status === 'loading'}>
              <Ionicons
                name="refresh"
                size={20}
                color={status === 'loading' ? c.textMuted : c.primary}
              />
            </Pressable>
          ) : (
            <View style={{ width: 20 }} />
          )}
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {inTimeline ? (
            <TimelineView
              c={c}
              selected={selected}
              history={history}
              loading={historyLoading}
              restoring={restoring}
              onRestore={confirmRestore}
            />
          ) : (
            <FeedView c={c} status={status} days={days} error={error} onOpen={openTimeline} />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function FeedView({
  c,
  status,
  days,
  error,
  onOpen,
}: {
  c: AppColors;
  status: ReturnType<typeof useActivityFeed>['status'];
  days: ReturnType<typeof useActivityFeed>['days'];
  error: string | null;
  onOpen: (item: ActivityItem) => void;
}) {
  return (
    <>
      <Heading style={[styles.title, { color: c.textPrimary }]}>Activity</Heading>
      <Caption style={{ color: c.textMuted }}>
        Every change to your goals, routine and reflections — across your devices. Tap any item to
        see its history and restore an earlier version.
      </Caption>

      {status === 'loading' ? (
        <Card style={styles.loadCard}>
          <LoadingDots />
        </Card>
      ) : status === 'error' ? (
        <Caption style={{ color: c.error, marginTop: spacing.lg }}>
          {error ?? 'Could not load your activity.'}
        </Caption>
      ) : days.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="time-outline" size={28} color={c.textMuted} />
          <Body style={{ color: c.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
            No changes recorded yet. As you set goals, plan your day and reflect, your history shows
            up here.
          </Body>
        </Card>
      ) : (
        days.map((group, gi) => (
          <Animated.View key={group.day} entering={FadeInDown.delay(gi * 40).duration(260)}>
            <SectionLabel>{dayLabel(group.day)}</SectionLabel>
            <Card style={styles.dayCard}>
              {group.items.map((item, i) => (
                <View key={item.id}>
                  {i > 0 ? <View style={[styles.divider, { backgroundColor: c.border }]} /> : null}
                  <Pressable
                    onPress={() => onOpen(item)}
                    style={({ pressed }) => [
                      styles.itemRow,
                      { backgroundColor: pressed ? c.surfaceAlt : 'transparent' },
                    ]}
                  >
                    <Ionicons
                      name={iconFor(item.entity)}
                      size={20}
                      color={opColor(item.op, c)}
                      style={styles.itemIcon}
                    />
                    <View style={{ flex: 1 }}>
                      <Body style={{ color: c.textPrimary }}>
                        {item.verb} {item.entityLabel}
                        {item.title ? `: ${item.title}` : ''}
                      </Body>
                      <Caption style={{ color: c.textMuted, marginTop: 2 }}>
                        {format(parseISO(item.ts), 'HH:mm')}
                        {item.changedFields.length > 0
                          ? ` · ${item.changedFields.map(prettifyKey).join(', ')}`
                          : ''}
                        {item.fromThisDevice ? '' : ' · another device'}
                      </Caption>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
                  </Pressable>
                </View>
              ))}
            </Card>
          </Animated.View>
        ))
      )}
    </>
  );
}

function TimelineView({
  c,
  selected,
  history,
  loading,
  restoring,
  onRestore,
}: {
  c: AppColors;
  selected: Selected;
  history: HistoryEntry[] | null;
  loading: boolean;
  restoring: boolean;
  onRestore: (entry: HistoryEntry) => void;
}) {
  // Newest first: the current state is on top; older versions below carry the
  // restore affordance (restoring to the current state would be a no-op).
  const ordered = history ? [...history].reverse() : [];

  return (
    <>
      <Heading style={[styles.title, { color: c.textPrimary }]} numberOfLines={2}>
        {selected.label}
        {selected.title ? `: ${selected.title}` : ''}
      </Heading>
      <Caption style={{ color: c.textMuted }}>
        {selected.restorable
          ? 'Tap Restore on any earlier version to bring it back.'
          : "This type only moves forward (its totals can't be lowered), so it's shown here for reference."}
      </Caption>

      {loading ? (
        <Card style={styles.loadCard}>
          <LoadingDots />
        </Card>
      ) : ordered.length === 0 ? (
        <Caption style={{ color: c.textMuted, marginTop: spacing.lg }}>
          No history found for this item.
        </Caption>
      ) : (
        <Card style={styles.dayCard}>
          {ordered.map((entry, i) => {
            const isCurrent = i === 0;
            const canRestore = selected.restorable && !isCurrent && !restoring;
            return (
              <View key={entry.id}>
                {i > 0 ? <View style={[styles.divider, { backgroundColor: c.border }]} /> : null}
                <View style={styles.timelineRow}>
                  <View style={{ flex: 1 }}>
                    <Body style={{ color: c.textPrimary }}>
                      {isCurrent
                        ? 'Current version'
                        : entry.op === 'insert'
                          ? 'Created'
                          : entry.op === 'delete'
                            ? 'Removed'
                            : 'Edited'}
                    </Body>
                    <Caption style={{ color: c.textMuted, marginTop: 2 }}>
                      {format(parseISO(entry.ts), 'MMM d, HH:mm')}
                      {snapshotTitle(selected.entity, entry.after)
                        ? ` · ${snapshotTitle(selected.entity, entry.after)}`
                        : ''}
                    </Caption>
                  </View>
                  {canRestore ? (
                    <Pressable
                      onPress={() => onRestore(entry)}
                      style={({ pressed }) => [
                        styles.restoreBtn,
                        { borderColor: c.primary, backgroundColor: pressed ? c.primary + '22' : 'transparent' },
                      ]}
                    >
                      <Label color={c.primary}>RESTORE</Label>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  title: {
    fontSize: fontSizes.xxl,
    marginTop: spacing.sm,
  },
  loadCard: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl, marginTop: spacing.md },
  dayCard: { marginTop: spacing.sm, paddingVertical: spacing.xs },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: 12,
  },
  itemIcon: { marginTop: 2 },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  restoreBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
