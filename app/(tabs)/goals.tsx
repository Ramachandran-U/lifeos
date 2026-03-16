import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { Body, Caption } from '@/components/ui/Typography';
import { GoalCard } from '@/components/modules/goals/GoalCard';
import { AddGoalSheet } from '@/components/modules/goals/AddGoalSheet';
import { useUserStore } from '@/store/useUserStore';
import { useGoalStore } from '@/store/useGoalStore';
import { getChildGoals, updateGoalStatus } from '@/db/queries/goals';

export default function GoalsScreen() {
  const { userId } = useUserStore();
  const { goals, loadGoals } = useGoalStore();
  const [showAddSheet, setShowAddSheet] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (userId) loadGoals(userId);
    }, [userId, loadGoals])
  );

  const lifeGoals = goals.filter((g) => g.level === 'life');
  const primaryGoal = lifeGoals[0];
  const otherGoals = goals.filter((g) => g.level !== 'life' && g.level !== 'daily');

  const dailyTasks = goals.filter((g) => g.level === 'daily' && g.status === 'active');

  const handleCompleteTask = (id: string) => {
    updateGoalStatus(id, 'completed');
    if (userId) loadGoals(userId);
  };

  const calculateProgress = (goalId: string): number => {
    const children = getChildGoals(goalId);
    if (children.length === 0) return 0;
    const completed = children.filter((c) => c.status === 'completed').length;
    return (completed / children.length) * 100;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <ModuleHeader title="Goals" icon="flag" color={colors.goal} />

        {primaryGoal ? (
          <Animated.View entering={FadeInDown.duration(400)}>
            <GoalCard
              title={primaryGoal.title}
              level={primaryGoal.level}
              status={primaryGoal.status}
              progress={calculateProgress(primaryGoal.id)}
              isPrimary
            />
          </Animated.View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="flag-outline" size={48} color={colors.textMuted} />
            <Body style={styles.emptyText}>No goals yet</Body>
            <Caption>Tap + to add your first goal</Caption>
          </View>
        )}

        {dailyTasks.length > 0 && (
          <View style={styles.section}>
            <Body style={styles.sectionTitle}>Today's Tasks</Body>
            {dailyTasks.map((task) => (
              <Pressable
                key={task.id}
                style={styles.taskRow}
                onPress={() => handleCompleteTask(task.id)}
              >
                <Ionicons name="ellipse-outline" size={20} color={colors.goal} />
                <Body style={styles.taskText}>{task.title}</Body>
              </Pressable>
            ))}
          </View>
        )}

        {otherGoals.length > 0 && (
          <View style={styles.section}>
            <Body style={styles.sectionTitle}>All Goals</Body>
            {otherGoals.map((goal, i) => (
              <Animated.View key={goal.id} entering={FadeInDown.delay(i * 80).duration(300)}>
                <GoalCard
                  title={goal.title}
                  level={goal.level}
                  status={goal.status}
                  progress={calculateProgress(goal.id)}
                />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable
        style={styles.fab}
        onPress={() => setShowAddSheet(true)}
      >
        <Ionicons name="add" size={28} color={colors.textPrimary} />
      </Pressable>

      <AddGoalSheet
        visible={showAddSheet}
        onClose={() => {
          setShowAddSheet(false);
          if (userId) loadGoals(userId);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    marginTop: spacing.sm,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  taskText: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSizes.lg,
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.goal,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
