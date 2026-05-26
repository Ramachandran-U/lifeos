import { useRef, useState } from 'react';
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
import { createGoal } from '@/db/queries/goals';
import { persistHierarchy } from '@/utils/persistHierarchy';
import type { GoalHierarchy } from '@/ai/types';

interface AddGoalSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function AddGoalSheet({ visible, onClose }: AddGoalSheetProps) {
  const c = useColors();
  const styles = makeStyles(c);
  const { call, error } = useAI();
  const { userId, name } = useUserStore();
  const loadGoals = useGoalStore((s) => s.loadGoals);

  const [goalText, setGoalText] = useState('');
  const [hierarchy, setHierarchy] = useState<GoalHierarchy | null>(null);
  // BUG-012: a cold decompose call runs ~15-20s with no feedback. Show a
  // "still working" hint after 8s, and let the user abandon the wait.
  const [slowHint, setSlowHint] = useState(false);
  const [decomposing, setDecomposing] = useState(false);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const clearSlowTimer = () => {
    if (slowTimer.current) { clearTimeout(slowTimer.current); slowTimer.current = null; }
  };

  const handleDecompose = async () => {
    if (!goalText.trim()) return;
    cancelledRef.current = false;
    abortRef.current = new AbortController();
    setSlowHint(false);
    setDecomposing(true);
    slowTimer.current = setTimeout(() => setSlowHint(true), 8000);
    const result = await call(() => decomposeGoal({ visionStatement: goalText, name }, { signal: abortRef.current?.signal }));
    clearSlowTimer();
    setSlowHint(false);
    setDecomposing(false);
    // If the user tapped Cancel while we were waiting, drop the late result.
    if (cancelledRef.current) return;
    if (result) setHierarchy(result);
  };

  const handleSave = () => {
    if (!hierarchy || !userId) return;

    // Use the canonical persister so /goals and onboarding share ONE path and
    // ALL five levels (life→yearly→monthly→weekly→daily) are saved. The inline
    // version here previously dropped weekly + dailyTaskExamples. (BUG-001 #2)
    persistHierarchy(userId, hierarchy, createGoal);
    loadGoals(userId);

    setGoalText('');
    setHierarchy(null);
    onClose();
  };

  const handleCancelDecompose = () => {
    cancelledRef.current = true;
    abortRef.current?.abort(); // truly cancels the in-flight request (BUG-012)
    clearSlowTimer();
    setSlowHint(false);
    setDecomposing(false);
  };

  const handleClose = () => {
    handleCancelDecompose();
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

          {!hierarchy && !decomposing && (
            <Button title="Decompose goal" onPress={handleDecompose} disabled={!goalText.trim()} />
          )}

          {decomposing && (
            <View style={styles.loadingContainer}>
              <LoadingDots />
              <Body style={styles.loadingText}>
                {slowHint
                  ? 'Still working — big goals can take ~20s. Hang tight or cancel.'
                  : 'Breaking down your goal...'}
              </Body>
              <Button title="Cancel" variant="ghost" onPress={handleCancelDecompose} />
            </View>
          )}

          {error && !decomposing && <Body style={styles.errorText}>{error}</Body>}

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
