import { useState, useCallback, useMemo, type ReactElement } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { Body, Caption } from '@/components/ui/Typography';
import { GoalCard } from '@/components/modules/goals/GoalCard';
import { AddGoalSheet } from '@/components/modules/goals/AddGoalSheet';
import { GoalDetailSheet } from '@/components/modules/goals/GoalDetailSheet';
import { MotivationBanner } from '@/components/shared/MotivationBanner';
import { useUserStore } from '@/store/useUserStore';
import { useGoalStore } from '@/store/useGoalStore';
import { updateGoalStatus } from '@/db/queries/goals';
import { listGoalComments } from '@/db/queries/goalComments';
import { GOAL_TYPE_LEGEND, useGoalTypeColor } from '@/utils/goalTypeColor';
import { useScreenTracking } from '@/hooks/useScreenTracking';

type GoalLike = ReturnType<typeof import('@/db/queries/goals').getGoalsByUser>[number];

export default function GoalsScreen() {
  const c = useColors();
  useScreenTracking('goals');
  const getTypeColor = useGoalTypeColor();
  const { userId } = useUserStore();
  const { goals, loadGoals } = useGoalStore();
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [detailGoalId, setDetailGoalId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      if (userId) loadGoals(userId);
    }, [userId, loadGoals])
  );

  const mainGoals = useMemo(
    () => goals.filter((g) => !g.parentId && g.level !== 'daily'),
    [goals],
  );

  const childrenByParent = useMemo(() => {
    const map: Record<string, GoalLike[]> = {};
    for (const g of goals) {
      if (!g.parentId) continue;
      (map[g.parentId] = map[g.parentId] ?? []).push(g);
    }
    return map;
  }, [goals]);

  const dailyTasks = goals.filter((g) => g.level === 'daily' && g.status === 'active');

  const commentCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const g of goals) map[g.id] = listGoalComments(g.id).length;
    return map;
  }, [goals, version]);

  const countDescendants = (id: string): { total: number; completed: number } => {
    const queue = [...(childrenByParent[id] ?? [])];
    let total = 0, completed = 0;
    while (queue.length) {
      const g = queue.shift()!;
      total += 1;
      if (g.status === 'completed') completed += 1;
      queue.push(...(childrenByParent[g.id] ?? []));
    }
    return { total, completed };
  };

  const progressFor = (id: string): number => {
    const { total, completed } = countDescendants(id);
    if (total === 0) return 0;
    return (completed / total) * 100;
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCompleteTask = (id: string) => {
    updateGoalStatus(id, 'completed');
    if (userId) loadGoals(userId);
  };

  const detailGoal = detailGoalId ? goals.find((g) => g.id === detailGoalId) : null;

  const styles = makeStyles(c);

  const renderGoalNode = (goal: GoalLike, depth: number): ReactElement => {
    const children = childrenByParent[goal.id] ?? [];
    const isExpanded = expandedIds.has(goal.id);
    const hasChildren = children.length > 0;
    const tc = getTypeColor(goal.goalType);

    return (
      <View key={goal.id} style={[styles.nodeWrap, depth > 0 && { marginLeft: spacing.md, borderLeftColor: tc.color, borderLeftWidth: 2, paddingLeft: spacing.md }]}>
        <View style={styles.nodeRow}>
          <View style={{ flex: 1 }}>
            <GoalCard
              title={goal.title}
              level={goal.level}
              status={goal.status}
              progress={progressFor(goal.id)}
              goalType={goal.goalType}
              commentCount={commentCounts[goal.id] ?? 0}
              onPress={() => setDetailGoalId(goal.id)}
              isPrimary={depth === 0 && goal.level === 'life'}
            />
          </View>
          {hasChildren && (
            <Pressable
              onPress={() => toggleExpand(goal.id)}
              style={[styles.chevronBtn, { backgroundColor: tc.light, borderColor: tc.color + '55' }]}
              hitSlop={8}
            >
              <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={tc.color} />
              <Caption style={{ color: tc.color, fontFamily: fonts.heading }}>{children.length}</Caption>
            </Pressable>
          )}
        </View>

        {depth === 0 && isExpanded && (
          <MotivationBanner module="goals" context={goal.title} accent={tc.color} />
        )}

        {isExpanded && hasChildren && (
          <View style={styles.childrenWrap}>
            {children.map((child) => renderGoalNode(child, depth + 1))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <ModuleHeader title="Goals" icon="flag" color={c.goal} />

        <View style={styles.legendRow}>
          {GOAL_TYPE_LEGEND.map((entry) => {
            const tc = getTypeColor(entry.goalType);
            return (
              <View key={entry.goalType} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: tc.color }]} />
                <Caption style={{ color: c.textSecondary }}>{entry.label}</Caption>
              </View>
            );
          })}
        </View>

        {mainGoals.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="flag-outline" size={48} color={c.textMuted} />
            <Body style={styles.emptyText}>No goals yet</Body>
            <Caption>Tap + to add your first goal</Caption>
          </View>
        ) : (
          <View style={styles.section}>
            {mainGoals.map((g, i) => (
              <Animated.View key={g.id} entering={FadeInDown.delay(i * 60).duration(300)}>
                {renderGoalNode(g, 0)}
              </Animated.View>
            ))}
          </View>
        )}

        {dailyTasks.length > 0 && (
          <View style={styles.section}>
            <Body style={styles.sectionTitle}>Today's Tasks</Body>
            {dailyTasks.map((task) => {
              const tc = getTypeColor(task.goalType);
              return (
                <Pressable
                  key={task.id}
                  style={[styles.taskRow, { borderLeftColor: tc.color }]}
                  onPress={() => handleCompleteTask(task.id)}
                >
                  <Ionicons name="ellipse-outline" size={20} color={tc.color} />
                  <Body style={styles.taskText}>{task.title}</Body>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => setShowAddSheet(true)}>
        <Ionicons name="add" size={28} color="#FFF" />
      </Pressable>

      <AddGoalSheet
        visible={showAddSheet}
        onClose={() => {
          setShowAddSheet(false);
          if (userId) loadGoals(userId);
        }}
      />

      {detailGoal && userId && (
        <GoalDetailSheet
          visible={!!detailGoalId}
          onClose={() => setDetailGoalId(null)}
          goalId={detailGoal.id}
          goalTitle={detailGoal.title}
          goalType={detailGoal.goalType}
          goalLevel={detailGoal.level}
          initialDescription={detailGoal.description ?? ''}
          userId={userId}
          onCommentChange={() => setVersion((v) => v + 1)}
          onDescriptionChange={() => {
            if (userId) loadGoals(userId);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
    legendRow: {
      flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md,
      paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
      backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    section: { gap: spacing.sm },
    sectionTitle: {
      fontFamily: fonts.heading, fontSize: fontSizes.lg, marginTop: spacing.sm, color: c.textPrimary,
    },
    nodeWrap: { gap: spacing.sm },
    nodeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    chevronBtn: {
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      width: 44, paddingVertical: spacing.xs, borderRadius: 12, borderWidth: 1,
    },
    childrenWrap: { gap: spacing.sm, marginTop: spacing.xs },
    taskRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
      backgroundColor: c.card, borderRadius: 12,
      borderWidth: 1, borderColor: c.border, borderLeftWidth: 4,
    },
    taskText: { flex: 1, color: c.textPrimary },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
    emptyText: { color: c.textMuted, fontSize: fontSizes.lg },
    fab: {
      position: 'absolute', bottom: 100, right: spacing.xl,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: c.goal, alignItems: 'center', justifyContent: 'center',
      elevation: 6, shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    },
  });
}
