import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Display, Body, Label, Caption } from '@/components/ui/Typography';
import { formatMoney } from '@/utils/currency';

interface FinanceGoalCardProps {
  title: string;
  goalType: string;
  targetAmount: number;
  currentSaved: number;
  monthlyTarget: number;
  targetDate: string;
}

const GOAL_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: 'home',
  retirement: 'umbrella',
  education: 'school',
  business: 'storefront',
  emergency_fund: 'shield-checkmark',
  financial_freedom: 'rocket',
  other: 'cash',
};

export function FinanceGoalCard({
  title,
  goalType,
  targetAmount,
  currentSaved,
  monthlyTarget,
  targetDate,
}: FinanceGoalCardProps) {
  const c = useColors();
  const styles = makeStyles(c);
  const progress = targetAmount > 0 ? (currentSaved / targetAmount) * 100 : 0;
  const icon = GOAL_TYPE_ICONS[goalType] ?? 'cash';
  const formattedTarget = formatMoney(targetAmount);
  const formattedSaved = formatMoney(currentSaved);

  return (
    <Card moduleColor={c.finance} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={20} color={c.finance} />
        </View>
        <View style={styles.headerText}>
          <Label color={c.finance}>YOUR GOAL</Label>
          <Body style={styles.title}>{title}</Body>
        </View>
      </View>

      <View style={styles.amountRow}>
        <Display style={styles.amount}>{formattedSaved}</Display>
        <Caption> / {formattedTarget}</Caption>
      </View>

      <ProgressBar value={progress} color={c.finance} height={10} />

      <View style={styles.footer}>
        <Caption>{Math.round(progress)}% complete</Caption>
        <Caption>Target: {formatMoney(monthlyTarget)}/mo</Caption>
      </View>
    </Card>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.financeDim + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  amount: {
    color: colors.finance,
    fontSize: fontSizes.display,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
