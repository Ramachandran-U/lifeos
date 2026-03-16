import { View, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Body, Label, Caption } from '@/components/ui/Typography';

interface GoalCardProps {
  title: string;
  level: string;
  status: string;
  progress: number;
  isPrimary?: boolean;
}

export function GoalCard({ title, level, status, progress, isPrimary }: GoalCardProps) {
  return (
    <Card moduleColor={colors.goal} style={isPrimary ? styles.primaryCard : styles.card}>
      <View style={styles.header}>
        <Label color={colors.goal}>{level.toUpperCase()}</Label>
        <Caption>{status}</Caption>
      </View>
      <Body style={[styles.title, isPrimary && styles.primaryTitle]}>{title}</Body>
      <ProgressBar value={progress} color={colors.goal} height={isPrimary ? 8 : 6} />
      <Caption style={styles.progressText}>{Math.round(progress)}% complete</Caption>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  primaryCard: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.md,
  },
  primaryTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
  },
  progressText: {
    textAlign: 'right',
  },
});
