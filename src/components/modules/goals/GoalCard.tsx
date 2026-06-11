import { View, StyleSheet, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Body, Label, Caption } from '@/components/ui/Typography';
import { usePressScale } from '@/hooks/usePressScale';
import { useGoalTypeColor } from '@/utils/goalTypeColor';

interface GoalCardProps {
  title: string;
  level: string;
  status: string;
  progress: number;
  goalType?: string;
  commentCount?: number;
  isPrimary?: boolean;
  onPress?: () => void;
  /** Total descendant steps. When 0, the goal is a leaf and progress is hidden. */
  stepCount?: number;
  stepsComplete?: number;
}

export function GoalCard({
  title, level, status, progress, goalType = 'personal', commentCount = 0, isPrimary, onPress,
  stepCount = 0, stepsComplete = 0,
}: GoalCardProps) {
  const c = useColors();
  const typeColor = useGoalTypeColor()(goalType);
  const press = usePressScale(0.98);

  const hasSteps = stepCount > 0;
  const progressLabel = hasSteps
    ? `${stepsComplete} of ${stepCount} steps`
    : `${Math.round(progress)}% complete`;

  const content = (
    <Card moduleColor={typeColor.color} style={isPrimary ? styles.primaryCard : styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Label color={typeColor.color}>{typeColor.label.toUpperCase()}</Label>
          <Caption style={{ color: c.textMuted }}>· {level}</Caption>
        </View>
        <Caption style={{ color: c.textSecondary }}>{status}</Caption>
      </View>
      <Body style={[styles.title, isPrimary && styles.primaryTitle, { color: c.textPrimary }]}>
        {title}
      </Body>
      <ProgressBar value={progress} color={typeColor.color} height={isPrimary ? 8 : 6} />
      <View style={styles.footer}>
        <Caption style={{ color: c.textSecondary }}>{progressLabel}</Caption>
        {commentCount > 0 && (
          <View style={styles.commentBadge}>
            <Ionicons name="chatbubble-outline" size={12} color={c.textSecondary} />
            <Caption style={{ color: c.textSecondary }}>{commentCount}</Caption>
          </View>
        )}
      </View>
    </Card>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut}>
        <Animated.View style={press.animatedStyle}>{content}</Animated.View>
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  primaryCard: { gap: spacing.sm, padding: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.md },
  primaryTitle: { fontFamily: fonts.heading, fontSize: fontSizes.xl },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commentBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
