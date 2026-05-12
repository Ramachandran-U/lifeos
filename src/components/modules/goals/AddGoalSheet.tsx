import { useState } from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Body, Heading, Label } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { useAI } from '@/hooks/useAI';
import { decomposeGoal } from '@/ai/functions';
import { useUserStore } from '@/store/useUserStore';
import { useGoalStore } from '@/store/useGoalStore';
import type { GoalHierarchy } from '@/ai/types';

interface AddGoalSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function AddGoalSheet({ visible, onClose }: AddGoalSheetProps) {
  const c = useColors();
  const styles = makeStyles(c);
  const { call, loading, error } = useAI();
  const { userId, name } = useUserStore();
  const { addGoal } = useGoalStore();

  const [goalText, setGoalText] = useState('');
  const [hierarchy, setHierarchy] = useState<GoalHierarchy | null>(null);

  const handleDecompose = async () => {
    if (!goalText.trim()) return;
    const result = await call(() => decomposeGoal({ visionStatement: goalText, name }));
    if (result) setHierarchy(result);
  };

  const handleSave = () => {
    if (!hierarchy || !userId) return;

    const lifeGoalId = addGoal({
      userId,
      title: hierarchy.primaryGoal.title,
      goalType: hierarchy.primaryGoal.type,
      level: 'life',
      aiGenerated: true,
    });

    const yearlyId = addGoal({
      userId,
      title: hierarchy.yearly.title,
      goalType: hierarchy.primaryGoal.type,
      level: 'yearly',
      parentId: lifeGoalId,
      aiGenerated: true,
    });

    for (const m of hierarchy.monthly) {
      addGoal({
        userId,
        title: m.title,
        description: m.milestone,
        goalType: hierarchy.primaryGoal.type,
        level: 'monthly',
        parentId: yearlyId,
        aiGenerated: true,
      });
    }

    setGoalText('');
    setHierarchy(null);
    onClose();
  };

  const handleClose = () => {
    setGoalText('');
    setHierarchy(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Heading style={styles.title}>Add a goal</Heading>

          <Input
            label="What do you want to achieve?"
            placeholder="I want to..."
            value={goalText}
            onChangeText={setGoalText}
            multiline
            numberOfLines={3}
            style={styles.input}
          />

          {!hierarchy && !loading && (
            <Button title="Decompose goal" onPress={handleDecompose} disabled={!goalText.trim()} />
          )}

          {loading && (
            <View style={styles.loadingContainer}>
              <LoadingDots />
              <Body style={styles.loadingText}>Breaking down your goal...</Body>
            </View>
          )}

          {error && <Body style={styles.errorText}>{error}</Body>}

          {hierarchy && (
            <View style={styles.preview}>
              <Card moduleColor={c.goal}>
                <Label color={c.goal}>GOAL</Label>
                <Body style={styles.goalTitle}>{hierarchy.primaryGoal.title}</Body>
              </Card>
              <Card>
                <Label>THIS YEAR</Label>
                <Body>{hierarchy.yearly.title}</Body>
              </Card>
              {hierarchy.monthly.slice(0, 2).map((m) => (
                <Card key={m.month}>
                  <Label>MONTH {m.month}</Label>
                  <Body>{m.title}</Body>
                </Card>
              ))}
              <Button title="Save goal" onPress={handleSave} />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.md,
  },
  input: {
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
  },
  preview: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  goalTitle: {
    fontFamily: 'Nunito-Bold',
    fontSize: 17,
    marginTop: 4,
  },
});
