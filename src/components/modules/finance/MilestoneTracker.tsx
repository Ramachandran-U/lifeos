import { View, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Body, Label, Caption } from '@/components/ui/Typography';
import { formatMoney } from '@/utils/currency';

interface Milestone {
  id: string;
  title: string;
  targetAmount: number;
  targetDate: string;
  completedAt: string | null;
}

interface MilestoneTrackerProps {
  milestones: Milestone[];
  onComplete?: (id: string) => void;
}

export function MilestoneTracker({ milestones, onComplete }: MilestoneTrackerProps) {
  const handleComplete = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete?.(id);
  };

  return (
    <Card style={styles.card}>
      <Label color={colors.finance} style={styles.sectionLabel}>MILESTONES</Label>
      {milestones.map((m, i) => {
        const isCompleted = !!m.completedAt;
        const isNext = !isCompleted && (i === 0 || !!milestones[i - 1]?.completedAt);

        return (
          <View key={m.id} style={styles.row}>
            <View style={styles.timeline}>
              <View
                style={[
                  styles.dot,
                  isCompleted && styles.dotCompleted,
                  isNext && styles.dotNext,
                ]}
              >
                {isCompleted && (
                  <Ionicons name="checkmark" size={12} color={colors.background} />
                )}
              </View>
              {i < milestones.length - 1 && (
                <View style={[styles.line, isCompleted && styles.lineCompleted]} />
              )}
            </View>

            <View style={styles.content}>
              <Body
                style={[
                  styles.milestoneTitle,
                  isCompleted && styles.completedText,
                ]}
              >
                {m.title}
              </Body>
              <Caption>
                {formatMoney(m.targetAmount)} by {m.targetDate}
              </Caption>
            </View>

            {isNext && (
              <Pressable
                onPress={() => handleComplete(m.id)}
                style={styles.checkButton}
              >
                <Ionicons name="checkmark-circle-outline" size={28} color={colors.finance} />
              </Pressable>
            )}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
  },
  sectionLabel: {
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    minHeight: 56,
  },
  timeline: {
    width: 32,
    alignItems: 'center',
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  dotCompleted: {
    backgroundColor: colors.finance,
  },
  dotNext: {
    borderWidth: 2,
    borderColor: colors.finance,
    backgroundColor: 'transparent',
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  lineCompleted: {
    backgroundColor: colors.finance,
  },
  content: {
    flex: 1,
    paddingLeft: spacing.sm,
    paddingBottom: spacing.md,
  },
  milestoneTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.md,
  },
  completedText: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  checkButton: {
    padding: spacing.xs,
    alignSelf: 'flex-start',
  },
});
