import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Body, Label, Caption } from '@/components/ui/Typography';
import type { WeeklyFinanceInsight } from '@/ai/types';

interface WeeklyInsightCardProps {
  insight: WeeklyFinanceInsight;
}

export function WeeklyInsightCard({ insight }: WeeklyInsightCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="sparkles" size={18} color={colors.finance} />
        </View>
        <Label color={colors.finance}>WEEKLY INSIGHT</Label>
      </View>

      <Body style={styles.headline}>{insight.headline}</Body>
      <Caption style={styles.insightText}>{insight.insight}</Caption>

      <View style={styles.actionBox}>
        <Ionicons name="arrow-forward-circle" size={18} color={colors.finance} />
        <Body style={styles.actionText}>{insight.actionItem}</Body>
      </View>

      <Caption style={styles.motivational}>{insight.motivationalNote}</Caption>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.financeLight + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    color: colors.finance,
  },
  insightText: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
  actionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.sm,
  },
  actionText: {
    flex: 1,
    fontSize: fontSizes.sm,
  },
  motivational: {
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
